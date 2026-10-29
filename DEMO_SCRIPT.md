# Demo script (about 6 minutes)

Open two browser windows side by side (or one normal and one private window) so you can switch users quickly. Servers running, database freshly seeded.

**One-line opening:** "Patients own their medical history. This system lets doctors see it across hospitals only while the patient allows it, and proves every access."

## 1. The problem and the promise (30 seconds)
Say: scattered records, no consent control, lost referrals, late eye screening. "We fix all four, and everything you will see is enforced by the server, not just hidden in the screen."

## 2. Consent is the gatekeeper (90 seconds)
1. **Window A:** log in as **Dr. Rohan Mehta**. Show the **Home** dashboard (referrals waiting, urgent count).
2. Go to **Patients**, search `MRN-0001` (Arjun Nair). The result says **Consent valid** or **No valid consent**. Open the record.
3. **Window B:** log in as **patient** (`mrn-0001@demo.test`). Show **Who can see my record**. Click **Remove access** on Dr. Mehta.
4. **Window A:** try to open the record again. It is **refused**: "No valid consent. The attempt has been logged."
5. **Window B:** open **Who looked at it**. The refused attempt is listed with the doctor and time.
6. **Window B:** give Dr. Mehta access again (90 days). Window A now opens the record.

Say: "The patient decides. The server enforces it on every request. Refused attempts are still recorded."

## 3. One history across hospitals, and safe prescribing (60 seconds)
1. In an open record, point at the **timeline**: visits from different doctors and facilities in one place, plus **Allergies**.
2. **New encounter**, prescribe **Penicillin V** for a patient allergic to penicillin. The system **blocks it** and names the conflict. Show the override button and say it is logged.

## 4. Tracked referrals (45 seconds)
1. As Dr. Rao, **Refer patient** to Dr. Mehta (urgent, with a reason).
2. As Dr. Mehta, open **Referrals > Incoming**, **Accept**, then **Mark completed**.
3. Say: "Only the receiver accepts or completes. Only the sender cancels. Every change is in the audit log."

## 5. AI eye screening (2 minutes)
1. As **Dr. Anita Rao**, open Arjun Nair's record, click **Eye screening**.
2. Upload the **normal retina** photo: **Grade 0, no referral needed**.
3. Upload the **laser-scar diabetic retina** photo: **Grade 4, Proliferative**, plus the **Grad-CAM heatmap** showing where the model looked.
4. Point at the blue line: **a referral to Dr. Mehta was created automatically**, urgency set from the grade (2 routine, 3 urgent, 4 emergency).
5. Upload again: "an open referral already exists", no duplicate. If a worse grade comes, the urgency is raised.
6. As Dr. Mehta: the referral appears in **Incoming**.
7. Say: "The AI only suggests. The doctor confirms or corrects the grade."

## 6. Admin oversight (30 seconds)
Log in as **admin**: **Home** shows active consents, consents expiring, and **denied attempts in the last 7 days**. Open **Audit log**, tick **Show denied only**.

## Honest limits (say these before you are asked)
- Synthetic data only. Demo passwords. It is a prototype.
- The model reaches kappa 0.883 on a public dataset (about 93% sensitivity and specificity for the referral decision). It has not been tested on real hospital images and is not a medical device.

## Likely questions
- **"Why not just hide the button?"** The check runs on the server for every request. A hidden button changes nothing for someone calling the API directly.
- **"Why PostgreSQL?"** Consent, referrals and audit are relational and need constraints and transactions: referral plus audit row save together or not at all.
- **"What if a doctor must act in an emergency?"** Out of scope today. The roadmap includes a logged break-glass access mode.
- **"Is the AI trustworthy?"** It assists and a doctor confirms. We report its limits and show the heatmap so a doctor can see what it looked at.
