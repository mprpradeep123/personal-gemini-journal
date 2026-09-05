# Personal Gemini Journal — Secure AI Introspection & Reflection

A secure, user-authenticated journaling web application that enables multi-turn reflections and brainstorming with Google's Gemini API, securely isolating each user's entries in Google Cloud Firestore via Firebase Authentication.

---
## Architecture & Tech Stack
- **Frontend/Backend:** Full-stack app generated via Google AI Studio Custom Instructions.
- **Authentication:** Firebase Auth (Google Sign-In) ensuring strict identity boundaries.
- **Database:** Cloud Firestore with strict user-partitioned security rules (`users/{userId}/journals/...`) guaranteeing zero cross-user leakage.
- **AI Engine:** Gemini API for multi-turn Socratic journaling and automated sentiment/mood analytics.
- **Deployment:** Containerized and deployed serverless via Google Cloud Run (`asia-southeast1`).

---

## 1. Prerequisites & GCP API Setup

Ensure you have the Google Cloud SDK (`gcloud`) installed and authenticated:

```bash

# Set your project ID and region variables
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="asia-southeast1" # Or your target region, e.g., us-central1
gcloud config set project $PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com

```

---

## 2. Secret Manager Setup (Gemini API Key)

Secure your Gemini API key in Google Cloud Secret Manager and grant Cloud Run the `roles/secretmanager.secretAccessor` role:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Find your project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# 3. Grant the default Cloud Run compute service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

```

---

## 3. Database Security Configuration (Cloud Firestore)

Deploy the owner-bound security rules to ensure zero cross-user access:

### `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /journals/{journalId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /insights/{insightId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /{subcollection=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}

```

Deploy the rules using the Firebase CLI:

```bash
firebase deploy --only firestore:rules

```

---

## 4. Cloud Run Deployment Flow

Build and deploy the application container to Google Cloud Run:

```bash
# Build & Deploy to Cloud Run mounting the Secret Manager secret
gcloud run deploy personal-gemini-journal \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production"

```

---

## 5. Required Campaign Verification Binding

Apply the mandatory challenge verification label to register the Cloud Run service:

```bash
gcloud run services update personal-gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION

```

Verify the label has been applied:

```bash
gcloud run services describe personal-gemini-journal \
  --region=$REGION \
  --format="value(metadata.labels)"

```

---

## 6. Local Development

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev

# Production build test
npm run build

```

---

