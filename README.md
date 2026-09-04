# Personal Gemini Journal

A secure, production-grade journaling and brainstorming web application built with Google AI Studio, Firebase Authentication, Cloud Firestore, and deployed on Google Cloud Run.

## Architecture & Tech Stack
- **Frontend/Backend:** Full-stack app generated via Google AI Studio Custom Instructions.
- **Authentication:** Firebase Auth (Google Sign-In) ensuring strict identity boundaries.
- **Database:** Cloud Firestore with strict user-partitioned security rules (`users/{userId}/journals/...`) guaranteeing zero cross-user leakage.
- **AI Engine:** Gemini API for multi-turn Socratic journaling and automated sentiment/mood analytics.
- **Deployment:** Containerized and deployed serverless via Google Cloud Run (`asia-southeast1`).
