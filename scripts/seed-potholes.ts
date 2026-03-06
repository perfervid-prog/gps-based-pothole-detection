
const PROJECT_ID = "pothole-alert-f0058";
const FIREBASE_REST_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/potholes`;

const locations = [
    { name: "Itahari", lat: 26.6646, lng: 87.2718 },
    { name: "Belbari", lat: 26.6684, lng: 87.4305 },
    { name: "Biratchowk", lat: 26.6684, lng: 87.3817 },
    { name: "Biratnagar", lat: 26.4551, lng: 87.2701 },
    { name: "New Location", lat: 26.62365, lng: 87.36146 }
];

async function seed() {
    console.log("🚀 Starting to seed potholes at requested locations...");

    for (const loc of locations) {
        try {
            const response = await fetch(FIREBASE_REST_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fields: {
                        latitude: { stringValue: loc.lat.toString() },
                        longitude: { stringValue: loc.lng.toString() },
                        magnitude: { stringValue: "8500" }, // Simulated strong impact
                        reportedAt: { stringValue: new Date().toISOString() },
                        locationName: { stringValue: loc.name } // Extra field for clarity
                    }
                })
            });

            if (response.ok) {
                console.log(`✅ Added pothole at ${loc.name}`);
            } else {
                console.error(`❌ Failed to add ${loc.name}:`, await response.text());
            }
        } catch (error) {
            console.error(`❌ Error adding ${loc.name}:`, error);
        }
    }

    console.log("\n✨ Seeding complete! Check your app map.");
}

seed();
