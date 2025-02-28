import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Result } from '../result';
import { TrackInfo } from '../core/types';
import { aithraToolkitLogger } from '../core/logger';

interface PlaylistBuildResult {
  config: {
    name: string;
    creator: string;
    filesMetadata: Record<string, {
      artist: string;
      album: string;
      title: string;
      category: string;
    }>;
    fileNames: Record<string, {
      audioFileName: string;
      coverArtFileName: string;
    }>;
  };
  audioFiles: File[];
  imageFiles: File[];
}

export async function buildPlaylistConfig(
  folderPath: string,
  name: string,
  creator: string
): Promise<Result<PlaylistBuildResult, Error>> {
  aithraToolkitLogger.debug('Entering buildPlaylistConfig');
  try {

    // Normalize folder path
    const basePath = resolve(folderPath);

    // Read info.json to get metadata
    const infoPath = join(basePath, 'info.json');
    let trackMetadata: TrackInfo;
    try {
      const infoContent = await readFile(infoPath, 'utf-8');
      trackMetadata = JSON.parse(infoContent);
    } catch (err) {
      return Result.err(new Error(`Failed to read or parse info.json: ${err.message}`));
    }

    // Initialize collections
    const audioFiles: File[] = [];
    const imageFiles: File[] = [];
    const audioFileNames: string[] = [];
    const imageFileNames: string[] = [];

    // Read audio directory
    try {
      const audioPath = join(basePath, 'audio');
      const audioEntries = await readdir(audioPath, { withFileTypes: true });

      for (const entry of audioEntries) {
        if (entry.isFile()) {
          const filePath = join(audioPath, entry.name);
          const fileContent = await readFile(filePath);
          const file = new File([fileContent], entry.name, {
            type: 'audio/mpeg'
          });
          audioFiles.push(file);
          audioFileNames.push(entry.name);
        }
      }
    } catch (err) {
      return Result.err(new Error(`Failed to process audio files: ${err.message}`));
    }

    // Read images directory
    try {
      const imagesPath = join(basePath, 'images');
      const imageEntries = await readdir(imagesPath, { withFileTypes: true });

      for (const entry of imageEntries) {
        if (entry.isFile()) {
          const filePath = join(imagesPath, entry.name);
          const fileContent = await readFile(filePath);
          const file = new File([fileContent], entry.name, {
            type: 'image/jpeg'
          });
          imageFiles.push(file);
          imageFileNames.push(entry.name);
        }
      }
    } catch (err) {
      return Result.err(new Error(`Failed to process image files: ${err.message}`));
    }

    // Build the config object
    const config = {
      name,
      creator,
      filesMetadata: {},
      fileNames: {}
    };

    // Process each track from the metadata
    for (const track of trackMetadata) {
      const trackKey = Object.keys(track)[0];
      const metadata = track[trackKey].metadata;
      const trackId = trackKey;

      // Find corresponding files
      const audioFile = audioFileNames.find((name) => name.includes(trackKey));
      const imageFile = imageFileNames.find((name) => name.includes(trackKey));

      if (!audioFile || !imageFile) {
        return Result.err(
          new Error(`Missing files for track ${trackKey}. Audio: ${!!audioFile}, Image: ${!!imageFile}`)
        );
      }

      // Add metadata
      config.filesMetadata[trackId] = {
        artist: metadata.artist,
        album: metadata.album,
        title: metadata.title,
        category: metadata.category
      };

      // Add file names
      config.fileNames[trackId] = {
        audioFileName: audioFile,
        coverArtFileName: imageFile
      };
    }
    aithraToolkitLogger.debug('Exiting buildPlaylistConfig');
    return Result.ok({
      config,
      audioFiles,
      imageFiles
    });
  } catch (err) {
    return Result.err(
      new Error(`Failed to build playlist config: ${err instanceof Error ? err.message : String(err)}`)
    );
  }
}
