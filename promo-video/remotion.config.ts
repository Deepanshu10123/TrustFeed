import {Config} from '@remotion/cli/config';

// Lossless frames keep the small UI text crisp before it is compressed, and
// (unlike JPEG frames) give a standard yuv420p video that every player and
// LinkedIn treats the same way.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
