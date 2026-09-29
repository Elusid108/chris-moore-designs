// Video transcode (H.264, short side ≤ 720 px, 30 fps) + poster frame. Ported from the portfolio CMS.
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { targetDir, allocateMediaStem, scheduleUnlink } = require('./media');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const TEMP_DIR = path.join(os.tmpdir(), 'cmd-cms-uploads');

function probeMedia(filePath) {
  return new Promise((resolve) => ffmpeg.ffprobe(filePath, (err, data) => {
    if (err) return resolve({ duration: 0, hasAudio: false });
    resolve({ duration: data?.format?.duration || 0, hasAudio: (data?.streams || []).some((s) => s.codec_type === 'audio') });
  }));
}
const MAX_SHORT_SIDE = 720;
const VIDEO_FILTER = `fps=30,scale='if(gt(iw,ih),-2,min(${MAX_SHORT_SIDE},iw))':'if(gt(iw,ih),min(${MAX_SHORT_SIDE},ih),-2)'`;
function transcodeToH264(src, dest, onProgress, keepAudio) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(src).videoCodec('libx264').outputOptions(['-crf 26', '-preset medium', '-movflags +faststart', '-pix_fmt yuv420p']).videoFilters(VIDEO_FILTER);
    if (keepAudio) cmd.audioCodec('aac').audioBitrate('128k').audioChannels(2).audioFrequency(44100); else cmd.noAudio();
    cmd.on('progress', (p) => onProgress && onProgress(Math.min(99, Math.round(p.percent || 0)), p.timemark || '')).on('end', resolve).on('error', reject).save(dest);
  });
}
const extractFrame = (src, at, folder, filename) => new Promise((resolve, reject) => ffmpeg(src).on('end', resolve).on('error', reject).screenshots({ timestamps: [at], filename, folder }));

async function processVideoUpload(file, { family, product, title } = {}, onProgress, keepAudio = false) {
  const { abs: destDir, web: webDir } = targetDir({ family, product });
  const stem = allocateMediaStem(destDir, title || product || 'video', 'vid');
  const mp4 = `${stem}.mp4`, poster = `${stem}-poster.webp`, posterThumb = `${stem}-poster-thumb.webp`;
  fs.mkdirSync(destDir, { recursive: true });
  const probe = await probeMedia(file.path);
  const encodeAudio = Boolean(keepAudio && probe.hasAudio);
  await transcodeToH264(file.path, path.join(destDir, mp4), onProgress, encodeAudio);
  if (onProgress) onProgress(99, '');
  let posterOk = false;
  try {
    const at = probe.duration > 1 ? Math.min(probe.duration * 0.1, 3) : 0;
    const tmp = `${stem}-poster-tmp.jpg`;
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    await extractFrame(file.path, at, TEMP_DIR, tmp);
    const tmpPath = path.join(TEMP_DIR, tmp);
    if (fs.existsSync(tmpPath)) {
      const jpg = fs.readFileSync(tmpPath);
      await sharp(jpg).webp({ quality: 85 }).toFile(path.join(destDir, poster));
      await sharp(jpg).resize(800, null, { withoutEnlargement: true }).webp({ quality: 75 }).toFile(path.join(destDir, posterThumb));
      posterOk = true;
      scheduleUnlink(tmpPath);
    }
  } catch (err) { console.error('Poster extraction error:', err.message); }
  scheduleUnlink(file.path);
  return { type: 'video', url: `${webDir}/${mp4}`, poster: posterOk ? `${webDir}/${poster}` : null, thumb: posterOk ? `${webDir}/${posterThumb}` : null, caption: '', hasAudio: encodeAudio };
}

module.exports = { processVideoUpload, transcodeToH264, MAX_SHORT_SIDE };
