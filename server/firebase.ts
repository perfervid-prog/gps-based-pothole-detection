import admin from "firebase-admin";

// We'll use the default credentials for local testing with the Project ID
// For a production deployment (like Render/Railway), you would upload a service account key
// But for now, we'll try to use the REST-style initialization if possible or just the project ID
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "pothole-alert-f0058",
    });
}

export const db = admin.firestore();
