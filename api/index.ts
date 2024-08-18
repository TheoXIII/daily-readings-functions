import express from "express";
import {Express, Request, Response} from "express";
import dotenv from "dotenv";
import axios from "axios";
import cors from "cors";
import Parser from "rss-parser";
//import * as PlayHT from "playht";
import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech"; 
//import options from './read-daily-readings-5b360c5a020e.json'

const projectId = "read-daily-readings"

let parser = new Parser();

dotenv.config();

const app: Express = express();

let CLIENT_URL: string;

if (process.env.RUN_ENV && process.env.RUN_ENV === "production")
  CLIENT_URL = "https://daily-readings-self.vercel.app";
else
  CLIENT_URL = "*";

/*if (process.env.PLAYHT_API_KEY && process.env.PLAYHT_USER_ID)
  PlayHT.init({
    apiKey: process.env.PLAYHT_API_KEY,
    userId: process.env.PLAYHT_USER_ID,
  });*/

/*const options = {
  credentials: {
    client_email: "daily-readings-voice@read-daily-readings.iam.gserviceaccount.com",
    private_key: process.env.GOOGLE_API_KEY
  }
}*/

const client = new TextToSpeechClient({projectId});

// configure your stream
/*const streamingOptions: PlayHT.SpeechStreamOptions = {
  // must use turbo for the best latency
  voiceEngine: "PlayHT2.0-turbo",
  // this voice id can be one of our prebuilt voices or your own voice clone id, refer to the`listVoices()` method for a list of supported voices.
  voiceId:
    "s3://voice-cloning-zero-shot/85bfd45f-c96e-4b4a-82e9-3ca72426d24c/original/manifest.json",
  // you can pass any value between 8000 and 48000, 24000 is default
  sampleRate: 44100,
  // the generated audio encoding, supports 'raw' | 'mp3' | 'wav' | 'ogg' | 'flac' | 'mulaw'
  outputFormat: 'mp3',
  // playback rate of generated speech
  speed: 1,
};*/

// s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json


app.use(express.json());

app.use(cors(), function(req: Request, res: Response, next) {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/", (req: Request, res: Response) => {
  res.send("Working");
});

app.get("/feed", async (req: Request, res: Response) => {
  const items = (await parser.parseURL("https://catholic-daily-reflections.com/feed")).items;
  res.set("Access-Control-Allow-Origin", CLIENT_URL);
  res.send(items);
})

app.post("/reverse-geocode", async (req: Request, res: Response) => {
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;
  const {data} = await axios.get(`https://us1.locationiq.com/v1/reverse?key=${process.env.LOCATIONIQ_KEY}&lat=${latitude}&lon=${longitude}&format=json&`);
  res.set("Access-Control-Allow-Origin", CLIENT_URL);
  res.send(data);
});

app.get("/voice", async (req: Request, res: Response) => {
  if (req.query && typeof req.query.text === "string") {
    const text = decodeURI(req.query.text);
    //const text = "This is a test"
    console.log(text);
    //const playHTStartTime = Date.now();
    //let playHTTTFBMeasured = false;
    //const stream = await PlayHT.stream(text, streamingOptions);
    const request : protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: {text: text},
      voice: {languageCode: 'en-GB', ssmlGender: 'MALE'},
      audioConfig: {audioEncoding: 'MP3'},
    };
    try {
      const [response] = await client.synthesizeSpeech(request);
      /*stream.on("data", (chunk) => {
        if (!playHTTTFBMeasured) {
          const playHTTTFB = Date.now() - playHTStartTime;
          playHTTTFBMeasured = true;
          res.setHeader('X-PlayHT-TTFB', playHTTTFB);
        }
      //});*/
      res.set('content-type', 'audio/mp3');
      //stream.pipe(res);
      res.send(response.audioContent);
    } catch (e) {
      console.log("Error:",e)
    }
  }
});

export default app;