import { spawn } from 'node:child_process';
import { rm, rename, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const inputPath = join(rootDirectory, 'media', 'enterprise_architect_background_loop.mp4');
const outputPath = join(
  rootDirectory,
  'media',
  'enterprise_architect_background_loop_portrait.mp4'
);
const temporaryPath = outputPath.replace(/\.mp4$/u, '.tmp.mp4');
const targetWidth = 1080;
const targetHeight = 1440;
const targetAspectRatio = targetWidth / targetHeight;

if (!ffmpegPath || !ffprobeStatic.path) {
  throw new Error('Unable to resolve the local FFmpeg binaries. Run npm install first.');
}

const source = await probe(inputPath);
const sourceVideo = validateSource(source);
const cropWidth = makeEven(Math.floor(sourceVideo.height * targetAspectRatio));
const cropLeft = makeEven(Math.floor((sourceVideo.width - cropWidth) / 2));
const filter = [
  `crop=${cropWidth}:${sourceVideo.height}:${cropLeft}:0`,
  `scale=${targetWidth}:${targetHeight}:flags=lanczos`
].join(',');

await rm(temporaryPath, { force: true });

try {
  await run(ffmpegPath, [
    '-hide_banner',
    '-y',
    '-i', inputPath,
    '-map', '0:v:0',
    '-vf', filter,
    '-an',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '16',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-map_metadata', '-1',
    temporaryPath
  ], { inheritOutput: true });

  const output = await probe(temporaryPath);
  validateOutput(source, output);
  await rm(outputPath, { force: true });
  await rename(temporaryPath, outputPath);

  const outputStats = await stat(outputPath);
  console.log([
    'Portrait upload master generated:',
    `  source crop: ${cropWidth}x${sourceVideo.height}+${cropLeft}+0`,
    `  output: ${targetWidth}x${targetHeight}, H.264, no audio`,
    `  size: ${(outputStats.size / 1024 / 1024).toFixed(2)} MiB`,
    `  path: ${outputPath}`
  ].join('\n'));
} catch (error) {
  await rm(temporaryPath, { force: true });
  throw error;
}

function validateSource(metadata) {
  const videoStreams = metadata.streams.filter(({ codec_type: type }) => type === 'video');
  const audioStreams = metadata.streams.filter(({ codec_type: type }) => type === 'audio');

  if (videoStreams.length !== 1) {
    throw new Error(`Expected one source video stream, found ${videoStreams.length}.`);
  }
  if (audioStreams.length !== 0) {
    throw new Error('The background source must not contain audio.');
  }

  const [video] = videoStreams;
  if (!Number.isInteger(video.width) || !Number.isInteger(video.height)) {
    throw new Error('Unable to determine the source dimensions.');
  }
  if (video.width / video.height <= targetAspectRatio) {
    throw new Error('The source is not wide enough for a central 3:4 crop.');
  }

  return video;
}

function validateOutput(source, output) {
  const videoStreams = output.streams.filter(({ codec_type: type }) => type === 'video');
  const audioStreams = output.streams.filter(({ codec_type: type }) => type === 'audio');

  if (videoStreams.length !== 1 || audioStreams.length !== 0) {
    throw new Error('The portrait output must contain exactly one video stream and no audio.');
  }

  const [video] = videoStreams;
  if (video.codec_name !== 'h264' || video.width !== targetWidth || video.height !== targetHeight) {
    throw new Error(
      `Unexpected portrait format: ${video.codec_name} ${video.width}x${video.height}.`
    );
  }
  if (video.pix_fmt !== 'yuv420p') {
    throw new Error(`Unexpected portrait pixel format: ${video.pix_fmt}.`);
  }

  const sourceDuration = Number.parseFloat(source.format.duration);
  const outputDuration = Number.parseFloat(output.format.duration);
  if (!Number.isFinite(sourceDuration)
      || !Number.isFinite(outputDuration)
      || Math.abs(sourceDuration - outputDuration) > 0.1) {
    throw new Error(
      `Unexpected portrait duration: ${outputDuration}s (source: ${sourceDuration}s).`
    );
  }

  const sourceFrameRate = parseRate(
    source.streams.find(({ codec_type: type }) => type === 'video').avg_frame_rate
  );
  const outputFrameRate = parseRate(video.avg_frame_rate);
  if (Math.abs(sourceFrameRate - outputFrameRate) > 0.01) {
    throw new Error(
      `Unexpected portrait frame rate: ${outputFrameRate} fps (source: ${sourceFrameRate} fps).`
    );
  }
}

function parseRate(value) {
  const [numerator, denominator] = String(value).split('/').map(Number);
  const rate = numerator / denominator;
  if (!Number.isFinite(rate)) {
    throw new Error(`Unable to parse frame rate: ${value}.`);
  }

  return rate;
}

function makeEven(value) {
  return value - (value % 2);
}

async function probe(path) {
  const output = await run(ffprobeStatic.path, [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    path
  ]);

  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`FFprobe returned invalid JSON for ${path}.`);
  }
}

function run(command, args, { inheritOutput = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: inheritOutput ? 'inherit' : ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    if (!inheritOutput) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(
        `${command} exited with code ${code}${stderr ? `:\n${stderr}` : '.'}`
      ));
    });
  });
}
