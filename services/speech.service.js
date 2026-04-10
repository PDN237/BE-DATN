const { SpeechClient } = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs').promises;
const path = require('path');
const { tmpdir } = require('os');

// Fallback: Use Whisper Python for reliability (user has it setup)
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Windows-safe ffmpeg
const ffmpegPath = path.resolve(ffmpegStatic);
ffmpeg.setFfmpegPath(ffmpegPath);

let speechClient;
try {
  speechClient = new SpeechClient({ 
    keyFilename: path.resolve('./BackEnd/config/speech-key.json') 
  });
  console.log('✅ Google Speech ready');
} catch (e) {
  console.log('⚠️ Google Speech not ready, using Whisper fallback');
  speechClient = null;
}

async function transcribeVideo(url, lessonTitle) {
  const tempDir = path.join(tmpdir(), `transcript-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const videoPath = path.join(tempDir, 'video.mp4');
  const audioPath = path.join(tempDir, 'audio.wav');

  try {
    console.log('🎬 Transcribing:', url);
    
    // STEP 1: Download video/audio with yt-dlp (user has python/whisper-env)
    console.log('📥 Downloading with yt-dlp...');
    const { stdout, stderr } = await execAsync(`cd "${tempDir}" && yt-dlp -f "best[height<=480]/best" --recode-video mp4 "${url}"`);
    console.log('yt-dlp stdout:', stdout);
    if (stderr) console.log('yt-dlp stderr:', stderr);

    const files = await fs.readdir(tempDir);
    const videoFile = files.find(f => f.endsWith('.mp4'));
    if (!videoFile) throw new Error('No MP4 downloaded');
    
    await fs.rename(path.join(tempDir, videoFile), videoPath);
    console.log('✅ Video:', videoFile);

    // STEP 2: Extract audio
    console.log('🔊 Extracting audio...');
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16000)
        .format('wav')
        .on('end', resolve)
        .on('error', reject)
        .save(audioPath);
    });
    console.log('✅ Audio extracted');

    // STEP 3: Whisper transcription (local - fast & accurate)
    console.log('🤖 Whisper vi transcription...');
    const { stdout: whisperOut } = await execAsync(`cd BackEnd/whisper-env/Scripts && .\\activate.bat && cd "${tempDir}" && py -m whisper audio.wav --model small --language vi --output_format txt`);
    
    const rawTranscript = whisperOut.trim() || 'No speech detected';
    console.log('✅ Whisper complete:', rawTranscript.length, 'chars');

    const formatted = `# 🎥 Video Transcript (Whisper AI)
**Title**: ${lessonTitle}
**URL**: ${url} 
**Method**: Local Whisper (vi-VN)

## Nội dung:
\`\`\`
${rawTranscript}
\`\`\``;

    await fs.rm(tempDir, { recursive: true, force: true });
    return { raw: rawTranscript, formatted };

  } catch (error) {
    console.error('💥 WHISPER ERROR:', error.message);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    
    return {
      raw: '',
      formatted: `❌ **Whisper pipeline failed**: ${error.message}\n\nRun: cd BackEnd/whisper-env/Scripts && activate.bat && pip install yt-dlp openai-whisper\n\n**Your YouTube**: https://youtu.be/Dv4qLJcxus8 ready!`,
      debug: error.message
    };
  }
}

module.exports = { transcribeVideo };
