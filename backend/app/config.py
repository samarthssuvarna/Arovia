import os
from dotenv import load_dotenv

# override=True: values in .env win over any stale Windows environment variable
load_dotenv(override=True)

# Database settings are separate fields (no URL), so a password containing
# characters like @ # / : needs no encoding.
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "recordsdb")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.environ["DB_PASSWORD"]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
