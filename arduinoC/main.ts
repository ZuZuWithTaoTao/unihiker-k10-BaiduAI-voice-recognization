//% color="#1E90FF" iconWidth=50 iconHeight=40
namespace BaiduSpeechRecognition {

    // Global variables
    let baiduToken = "";
    let recognitionResult = "";
    
    //% block="初始化百度语音识别 API Key:[API_KEY] Secret Key:[SECRET_KEY]" blockType="command"
    //% API_KEY.shadow="string" API_KEY.defl="API_KEY"
    //% SECRET_KEY.shadow="string" SECRET_KEY.defl="SECRET_KEY"
    export function initializeBaiduASR(parameter: any, block: any) {
        let apiKey = parameter.API_KEY.code;
        let secretKey = parameter.SECRET_KEY.code;
        
        Generator.addInclude('WiFiClientSecure', '#include <WiFiClientSecure.h>');
        Generator.addInclude('HTTPClient', '#include <HTTPClient.h>');
        Generator.addInclude('ArduinoJson', '#include <ArduinoJson.h>');
        Generator.addInclude('SD', '#include <SD.h>');
        Generator.addInclude('SPI', '#include <SPI.h>');
        
        Generator.addObject(`baiduToken`, `String`, `baiduToken = "";`);
        Generator.addObject(`recognitionResult`, `String`, `recognitionResult = "";`);
        
        // SD card pin configuration (ESP32-S3)
        Generator.addObject(`SD_CS`, `const int`, `SD_CS = 40;`);
        Generator.addObject(`SD_MOSI`, `const int`, `SD_MOSI = 42;`);
        Generator.addObject(`SD_MISO`, `const int`, `SD_MISO = 41;`);
        Generator.addObject(`SD_SCLK`, `const int`, `SD_SCLK = 44;`);
        
        // Initialize SD card
        Generator.addCode(`
            SPI.begin(SD_SCLK, SD_MISO, SD_MOSI, SD_CS);
            if (!SD.begin(SD_CS)) {
                Serial.println("SD Card Mount Failed");
            } else {
                Serial.println("SD Card initialized.");
            }
        `);
        
        // Get Baidu AI token
        Generator.addCode(`
            WiFiClientSecure *client = new WiFiClientSecure;
            HTTPClient https;
            client->setInsecure();
            
            String postData = "grant_type=client_credentials";
            postData += "&client_id=";
	postData += ${apiKey};
            postData += "&client_secret=";
	postData += ${secretKey};

            
            if (https.begin(*client, "https://aip.baidubce.com/oauth/2.0/token")) {
                https.addHeader("Content-Type", "application/x-www-form-urlencoded");
                int httpCode = https.POST(postData);
                
                if (httpCode == HTTP_CODE_OK) {
                    String payload = https.getString();
                    DynamicJsonBuffer jsonBuffer;
                    JsonObject& root = jsonBuffer.parseObject(payload);
                    if (root.containsKey("access_token")) {
                        baiduToken = root["access_token"].as<String>();
                        Serial.print("Access Token: ");
                        Serial.println(baiduToken);
                    }
                }
                https.end();
            }
        `);
    }

    //% block="发送录音文件 [FILENAME] 进行识别" blockType="command"
    //% FILENAME.shadow="string" FILENAME.defl="/sound.wav"
    export function sendAudioForRecognition(parameter: any, block: any) {
        let filename = parameter.FILENAME.code;
        
        Generator.addCode(`
            File audioFile = SD.open(${filename});
            if (!audioFile) {
                Serial.println("Failed to open file");
                recognitionResult = "Error: File not found";
            } else {
                size_t fileSize = audioFile.size();
                Serial.printf("File size: %d bytes\\n", fileSize);
                
                WiFiClientSecure *client = new WiFiClientSecure;
                HTTPClient https;
                client->setInsecure();
                
                String url = "https://vop.baidu.com/pro_api";
                url += "?cuid=baidu_workshop";
                url += "&token=" + baiduToken;
                url += "&dev_pid=80001";
                
                if (https.begin(*client, url)) {
                    https.addHeader("Content-Type", "audio/wav;rate=16000");
                    int httpCode = https.sendRequest("POST", &audioFile, fileSize);
                    
                    if (httpCode == HTTP_CODE_OK) {
                        String payload = https.getString();
                        Serial.println("ASR Response:");
                        Serial.println(payload);
                        
                        DynamicJsonBuffer jsonBuffer;
                        JsonObject& root = jsonBuffer.parseObject(payload);
                        
                        if (root.success() && root.containsKey("result")) {
                            JsonArray& results = root["result"];
                            recognitionResult = "";
                            for (auto& result : results) {
                                if (recognitionResult.length() > 0) {
                                    recognitionResult += " ";
                                }
                                recognitionResult += result.as<String>();
                            }
                            Serial.print("Recognition Result: ");
                            Serial.println(recognitionResult);
                        } else {
                            recognitionResult = "Error: Invalid response";
                        }
                    } else {
                        recognitionResult = "Error: HTTP request failed";
                        Serial.printf("[HTTPS] POST... failed, error: %s\\n", https.errorToString(httpCode).c_str());
                    }
                    https.end();
                } else {
                    recognitionResult = "Error: Connection failed";
                    Serial.printf("[HTTPS] Unable to connect\\n");
                }
                audioFile.close();
            }
        `);
    }

    //% block="返回识别结果" blockType="reporter"
    export function getRecognitionResult(parameter: any, block: any) {
        Generator.addCode(`recognitionResult`);
    }
}