"""Diabetic retinopathy grading + Grad-CAM heatmap.

The model is a ResNet-18 with a 5-way output (grades 0 to 4).
  * If a trained weights file exists (backend/models/dr_resnet18.pt) it is used.
  * If not, an UNTRAINED demo network runs, so the whole pipeline can be shown.
    Its grades are NOT medical results, and the app says so on screen.
"""
import io
import threading
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models

BACKEND_DIR = Path(__file__).resolve().parents[2]
WEIGHTS_PATH = BACKEND_DIR / "models" / "dr_resnet18.pt"

GRADE_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]
IMG_SIZE = 224
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

_lock = threading.Lock()
_model = None
_version = None


def _build() -> nn.Module:
    net = models.resnet18(weights=None)
    net.fc = nn.Linear(net.fc.in_features, 5)
    return net


def get_model():
    """Load once, reuse for every request."""
    global _model, _version
    with _lock:
        if _model is None:
            net = _build()
            if WEIGHTS_PATH.exists():
                net.load_state_dict(torch.load(WEIGHTS_PATH, map_location="cpu"))
                _version = "resnet18-trained"
            else:
                _version = "demo-untrained"
            net.eval()
            _model = net
    return _model, _version


def is_demo() -> bool:
    return get_model()[1] == "demo-untrained"


def _preprocess(img: Image.Image) -> torch.Tensor:
    arr = np.asarray(img.convert("RGB").resize((IMG_SIZE, IMG_SIZE)), dtype=np.float32) / 255.0
    arr = (arr - MEAN) / STD
    return torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0)


def _jet(v: np.ndarray) -> np.ndarray:
    """Simple blue-to-red colour map. v is 0..1, returns H x W x 3 (0..255)."""
    r = np.clip(1.5 - np.abs(4 * v - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * v - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * v - 1), 0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def analyse(image_bytes: bytes):
    """Return (grade, confidence, probabilities, original_jpeg_bytes, heatmap_jpeg_bytes, model_version)."""
    model, version = get_model()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((512, 512))  # keep stored images small

    x = _preprocess(img)

    # forward pass with hooks on the last convolution block (Grad-CAM)
    store = {}

    def on_forward(_m, _i, out):
        store["acts"] = out
        out.register_hook(lambda g: store.__setitem__("grads", g))

    handle = model.layer4.register_forward_hook(on_forward)
    try:
        with torch.enable_grad():
            logits = model(x)
            probs = torch.softmax(logits, dim=1)[0]
            grade = int(probs.argmax())
            model.zero_grad()
            logits[0, grade].backward()
    finally:
        handle.remove()

    # Grad-CAM: weight each feature map by how much it pushed the chosen grade
    weights = store["grads"].mean(dim=(2, 3), keepdim=True)
    cam = torch.relu((weights * store["acts"]).sum(dim=1))[0].detach().numpy()
    cam = cam - cam.min()
    cam = cam / cam.max() if cam.max() > 0 else cam
    cam_img = Image.fromarray((cam * 255).astype(np.uint8)).resize(img.size, Image.BILINEAR)
    cam_arr = np.asarray(cam_img, dtype=np.float32) / 255.0

    overlay = (0.55 * np.asarray(img, dtype=np.float32) + 0.45 * _jet(cam_arr)).astype(np.uint8)

    def to_jpeg(im: Image.Image) -> bytes:
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=88)
        return buf.getvalue()

    return (
        grade,
        float(probs[grade]),
        [float(p) for p in probs],
        to_jpeg(img),
        to_jpeg(Image.fromarray(overlay)),
        version,
    )
