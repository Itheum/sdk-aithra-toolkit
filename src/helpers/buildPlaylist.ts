import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export async function buildPlaylistConfig(
  folderPath: string,
  name: string,
  creator: string
) {
  // Normalize folder path
  const basePath = resolve(folderPath);

  // Read info.json to get metadata
  const infoPath = join(basePath, 'info.json');
  const infoContent = await readFile(infoPath, 'utf-8');
  const trackMetadata = JSON.parse(infoContent);

  // Read files from audio and images directories
  const audioFiles: File[] = [];
  const imageFiles: File[] = [];
  const audioFileNames: string[] = [];
  const imageFileNames: string[] = [];

  try {
    // Read audio directory
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
  } catch (error) {
    console.error('Error reading audio files:', error);
  }

  try {
    // Read images directory
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
  } catch (error) {
    console.error('Error reading image files:', error);
  }

  // Build the config object
  const config = {
    name,
    creator,
    filesMetadata: {},
    fileNames: {}
  };

  // Process each track from the metadata
  trackMetadata.forEach((track) => {
    const trackKey = Object.keys(track)[0];
    const metadata = track[trackKey].metadata;
    const trackId = trackKey; // Use the original track key from metadata

    // Find corresponding files by matching pattern or prefix
    const audioFile = audioFileNames.find((name) => name.includes(trackKey));
    const imageFile = imageFileNames.find((name) => name.includes(trackKey));

    // Add metadata
    config.filesMetadata[trackId] = {
      artist: metadata.artist,
      album: metadata.album,
      title: metadata.title,
      category: metadata.category
    };

    // Add original file names
    config.fileNames[trackId] = {
      audioFileName: audioFile || '',
      coverArtFileName: imageFile || ''
    };
  });

  return {
    config,
    audioFiles,
    imageFiles
  };
}
