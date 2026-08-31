#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <time.h>
#include <soc/soc.h>
#include <soc/rtc_cntl_reg.h>

// ---------------- Configuration ----------------
const char* SSID         = "YOUR_WIFI_SSID";
const char* PASSWORD     = "YOUR_WIFI_PASSWORD";
const char* FIREBASE_URL = "https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/potholes";
const char* PROJECT_ID   = "YOUR_PROJECT_ID";

// ---------------- Forward Declarations ----------------
void syncSettings();
void connectWiFi();
void reportHeartbeat();
void reportPothole(float lat, float lon, float mag);
bool isWiFiReady();

// ---------------- GPS ----------------
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
#define GPS_RX 16
#define GPS_TX 17

// ---------------- MPU6050 ----------------
Adafruit_MPU6050 mpu;
sensors_event_t a, g, temp;
int32_t zOffset = 0;
const int CALIBRATION_SAMPLES = 100;

// ---------------- LED ----------------
#define LED_PIN 2
unsigned long lastBlink = 0;

// ---------------- Detection ----------------
#define SMA_SIZE 10
long zBuffer[SMA_SIZE] = {0};
int smaIdx = 0;
long zRunningSum = 0;

// Dynamic parameters (Fetched from Firestore)
long DIP_THRESHOLD             = 150;
long IMPACT_THRESHOLD          = 800;
unsigned long POTHOLE_WINDOW   = 300;

const unsigned long reportCooldown   = 3000;
const int sampleInterval             = 20;

bool potentialPothole      = false;
unsigned long dipDetectedTime  = 0;
unsigned long lastSampleTime   = 0;
unsigned long lastReportTime   = 0;

// ---------------- Sync Config ----------------
unsigned long lastConfigSyncTime     = 0;
const unsigned long configSyncInterval = 10000; // 10 seconds for fast updates
const char* CONFIG_URL = "https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/potholes/sensor_config";

// ---------------- Heartbeat ----------------
unsigned long lastHeartbeatTime        = 0;
const unsigned long heartbeatInterval  = 60000;

// ---------------- WiFi ----------------
unsigned long wifiLastRetry              = 0;
const unsigned long WIFI_RETRY_INTERVAL  = 30000;
bool wifiConnected = false;

// ============================================================
//  Data Readiness Check
// ============================================================
bool isGPSReady() {
  return gps.location.isValid() &&
         gps.location.age() < 2000 &&
         gps.hdop.isValid() &&
         gps.hdop.hdop() < 5.0;
}

bool isTimeReady() {
  time_t now = time(nullptr);
  return now > 1000000;
}

bool isWiFiReady() {
  return WiFi.status() == WL_CONNECTED;
}

bool allDataReady() {
  return isWiFiReady() && isGPSReady() && isTimeReady();
}

void printDataStatus() {
  Serial.println("--- Data Status ---");
  Serial.printf("   WiFi  : %s\n", isWiFiReady() ? "✅ Connected" : "❌ Not connected");
  Serial.printf("   GPS   : %s", isGPSReady()  ? "✅ Valid fix" : "❌ No fix");
  if (gps.location.isValid()) {
    Serial.printf(" (HDOP: %.1f, Age: %lums)", gps.hdop.hdop(), gps.location.age());
  }
  Serial.println();
  Serial.printf("   Time  : %s\n", isTimeReady() ? "✅ NTP synced" : "❌ Not synced");
  Serial.println("-------------------");
}

// ============================================================
//  WiFi
// ============================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    return;
  }

  if (millis() - wifiLastRetry < WIFI_RETRY_INTERVAL && wifiLastRetry != 0) return;
  wifiLastRetry = millis();

  Serial.printf("Connecting to WiFi: %s\n", SSID);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(SSID, PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 10000) {
      Serial.println("⚠️ WiFi timeout — will retry in 30s");
      wifiConnected = false;
      return;
    }
    delay(300);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Connected!");
  Serial.printf("   IP   : %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("   RSSI : %d dBm\n", WiFi.RSSI());
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  wifiConnected = true;
}

// ============================================================
//  Helpers
// ============================================================
String getTimestamp() {
  time_t now = time(nullptr);
  if (now < 1000000) return "";
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  return String(buf);
}

bool postToFirebase(String& payload) {
  if (!isWiFiReady()) return false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  bool success = false;
  if (http.begin(client, FIREBASE_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000);
    int code = http.POST(payload);
    if (code > 0) {
      Serial.printf("   Firebase response: %d\n", code);
      success = true;
    } else {
      Serial.printf("   Firebase error: %s\n", http.errorToString(code).c_str());
    }
    http.end();
  }
  return success;
}

// ============================================================
//  Sync Settings from Cloud
// ============================================================
void syncSettings() {
  if (!isWiFiReady()) return;

  Serial.println("🔄 Syncing settings from Cloud...");
  
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, CONFIG_URL)) {
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      StaticJsonDocument<1024> doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        JsonObject fields = doc["fields"];
        
        // Firestore stores doubles/ints in specific fields
        if (fields.containsKey("dipThreshold")) {
          DIP_THRESHOLD = fields["dipThreshold"]["doubleValue"].as<long>();
        }
        if (fields.containsKey("impactThreshold")) {
          IMPACT_THRESHOLD = fields["impactThreshold"]["integerValue"].as<long>();
        }
        if (fields.containsKey("potholeWindow")) {
          POTHOLE_WINDOW = fields["potholeWindow"]["integerValue"].as<unsigned long>();
        }

        Serial.println("✅ Settings updated (Cloud Sync):");
        Serial.printf("   > Dip   : %ld\n", DIP_THRESHOLD);
        Serial.printf("   > Impact: %ld\n", IMPACT_THRESHOLD);
        Serial.printf("   > Window: %lu ms\n", POTHOLE_WINDOW);
      } else {
        Serial.printf("❌ JSON Parse failed: %s\n", error.c_str());
      }
    } else if (httpCode == 404) {
      Serial.println("ℹ️ Config document not found — using local defaults.");
    } else {
      Serial.printf("❌ Sync failed, HTTP: %d\n", httpCode);
    }
    http.end();
  }
}

// ============================================================
//  Firebase Reports
// ============================================================
void reportPothole(float lat, float lon, float mag) {
  if (!allDataReady()) {
    Serial.println("⏸ Pothole detected but data not ready — skipping sync:");
    printDataStatus();
    return;
  }

  String ts = getTimestamp();
  if (ts.isEmpty()) {
    Serial.println("⏸ Timestamp not ready — skipping sync");
    return;
  }

  Serial.println("📤 Sending pothole to Firebase...");

  StaticJsonDocument<512> doc;
  JsonObject fields = doc.createNestedObject("fields");
  fields["latitude"]["doubleValue"]   = lat;
  fields["longitude"]["doubleValue"]  = lon;
  fields["magnitude"]["doubleValue"]  = mag;
  fields["reportedAt"]["stringValue"] = ts;
  fields["type"]["stringValue"]       = "hardware_pothole";

  String payload;
  serializeJson(doc, payload);

  if (postToFirebase(payload)) Serial.println("✅ Pothole synced!");
  else                         Serial.println("❌ Pothole sync failed");
}

void reportHeartbeat() {
  if (!isWiFiReady() || !isTimeReady()) {
    Serial.println("⏸ Heartbeat skipped — WiFi or time not ready");
    return;
  }

  String ts = getTimestamp();
  if (ts.isEmpty()) return;

  Serial.println("📤 Sending heartbeat...");

  StaticJsonDocument<256> doc;
  JsonObject fields = doc.createNestedObject("fields");
  fields["lastSeen"]["stringValue"]   = ts;
  fields["status"]["stringValue"]     = "online";
  fields["reportedAt"]["stringValue"] = ts;
  fields["type"]["stringValue"]       = "heartbeat";

  String payload;
  serializeJson(doc, payload);

  if (postToFirebase(payload)) Serial.println("✅ Heartbeat synced!");
  else                         Serial.println("❌ Heartbeat failed");
}

// ============================================================
//  MPU6050 Calibration
// ============================================================
void calibrateMPU6050() {
  Serial.println(">>> Calibrating MPU6050...");
  long sumZ = 0;
  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    mpu.getEvent(&a, &g, &temp);
    sumZ += (long)(a.acceleration.z * 1000);
    delay(10);
  }
  zOffset = sumZ / CALIBRATION_SAMPLES;
  Serial.printf("✅ Calibration done — zOffset: %d\n", zOffset);
}

// ============================================================
//  Setup
// ============================================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);
  Serial.println("\n=============================");
  Serial.println("   Pothole Detector Booting  ");
  Serial.println("=============================");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  if (!LittleFS.begin(true)) Serial.println("⚠️ LittleFS failed — continuing anyway");

  Wire.begin(21, 22);
  if (!mpu.begin()) {
    Serial.println("❌ MPU6050 not found! Check wiring.");
    while (1) delay(10);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("✅ MPU6050 OK");
  calibrateMPU6050();

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("✅ GPS OK");

  connectWiFi();
  if (wifiConnected) syncSettings();

  Serial.println("✅ Boot complete — starting loop");
  Serial.println("=============================\n");
}

// ============================================================
//  Main Loop
// ============================================================
void loop() {
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  unsigned long now = millis();
  connectWiFi();

  // Heartbeat every 60s
  if (wifiConnected && now - lastHeartbeatTime > heartbeatInterval) {
    lastHeartbeatTime = now;
    reportHeartbeat();
  }

  // Fast Config Sync every 30s
  if (wifiConnected && now - lastConfigSyncTime > configSyncInterval) {
    lastConfigSyncTime = now;
    syncSettings();
  }

  // Sample MPU at 50Hz
  if (now - lastSampleTime >= sampleInterval) {
    lastSampleTime = now;

    mpu.getEvent(&a, &g, &temp);
    long zRelative = (long)(a.acceleration.z * 1000) - zOffset;

    zRunningSum     -= zBuffer[smaIdx];
    zBuffer[smaIdx]  = zRelative;
    zRunningSum     += zBuffer[smaIdx];
    smaIdx           = (smaIdx + 1) % SMA_SIZE;
    long smoothedZ   = zRunningSum / SMA_SIZE;

    bool isPothole = false;

    if (smoothedZ < -DIP_THRESHOLD && !potentialPothole) {
      potentialPothole = true;
      dipDetectedTime  = now;
    }

    if (potentialPothole) {
      if (now - dipDetectedTime > POTHOLE_WINDOW) {
        potentialPothole = false;
      } else if (smoothedZ > IMPACT_THRESHOLD) {
        isPothole        = true;
        potentialPothole = false;
      }
    }

    if (isPothole && now - lastReportTime > reportCooldown) {
      lastReportTime = now;
      digitalWrite(LED_PIN, HIGH);
      lastBlink = now;

      float lat = gps.location.isValid() ? gps.location.lat() : 0.0;
      float lon = gps.location.isValid() ? gps.location.lng() : 0.0;

      Serial.println("\n⚠️  ====== POTHOLE DETECTED! ======");
      Serial.printf("   Magnitude : %ld\n", smoothedZ);
      Serial.printf("   Thresholds: Dip=%ld, Impact=%ld\n", DIP_THRESHOLD, IMPACT_THRESHOLD);
      Serial.printf("   Latitude  : %.6f\n", lat);
      Serial.printf("   Longitude : %.6f\n", lon);
      Serial.println("==================================\n");

      reportPothole(lat, lon, (float)smoothedZ);
    }

    if (now - lastBlink > 800) {
      digitalWrite(LED_PIN, LOW);
    }
  }
}
