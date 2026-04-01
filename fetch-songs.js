/**
 * fetch-songs.js
 * 
 * Fetches all songs from your StreamerSonglist profile
 * and generates the songs-data.js file for your GigRequest app.
 * 
 * Usage:
 *   node fetch-songs.js
 * 
 * This will overwrite server/songs-data.js with your StreamerSonglist songs.
 * After running, delete server/gig.db so the app rebuilds the database,
 * then commit and push to redeploy.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const STREAMER = "danielsingmusic";
const PAGE_SIZE = 100;
const OUTPUT = path.join(__dirname, "server", "songs-data.js");

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function fetchAllSongs() {
  let allSongs = [];
  let page = 0;
  let totalPages = 1;

  console.log(`Fetching songs for "${STREAMER}" from StreamerSonglist...\n`);

  while (page < totalPages) {
    const url = `https://api.streamersonglist.com/v1/streamers/${STREAMER}/songs?size=${PAGE_SIZE}&current=${page}`;
    console.log(`  Fetching page ${page + 1}...`);

    const data = await fetchJSON(url);

    // The API returns { items: [...], total: N }
    // or it might return an array directly — handle both
    let items, total;

    if (Array.isArray(data)) {
      items = data;
      total = data.length;
      totalPages = 1; // single page
    } else if (data.items) {
      items = data.items;
      total = data.total || items.length;
      totalPages = Math.ceil(total / PAGE_SIZE);
    } else if (data.list) {
      items = data.list;
      total = data.total || items.length;
      totalPages = Math.ceil(total / PAGE_SIZE);
    } else {
      // Maybe the response itself is the array
      console.error("Unexpected API response format:", JSON.stringify(data).slice(0, 200));
      console.log("\nTrying to treat the whole response as data...");
      items = Object.values(data).find(v => Array.isArray(v)) || [];
      totalPages = 1;
    }

    for (const song of items) {
      const title = song.title || song.name || "";
      const artist = song.artist || "";
      if (title) {
        allSongs.push({ title: title.trim(), artist: artist.trim() });
      }
    }

    console.log(`  Got ${items.length} songs (${allSongs.length} total so far)`);
    page++;

    // Small delay to be polite to the API
    if (page < totalPages) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return allSongs;
}

function generateFile(songs) {
  // Sort alphabetically by title
  songs.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  // Remove duplicates
  const seen = new Set();
  const unique = songs.filter((s) => {
    const key = `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build the JS file content
  const entries = unique
    .map((s) => {
      const title = s.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const artist = s.artist.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `  { title: "${title}", artist: "${artist}" }`;
    })
    .join(",\n");

  const content = `const songs = [\n${entries}\n];\n\nmodule.exports = songs;\n`;

  fs.writeFileSync(OUTPUT, content, "utf-8");
  console.log(`\nWrote ${unique.length} songs to ${OUTPUT}`);
}

async function main() {
  try {
    const songs = await fetchAllSongs();

    if (songs.length === 0) {
      console.error("\nNo songs found! Check that the streamer name is correct.");
      console.log(`Tried: https://www.streamersonglist.com/t/${STREAMER}/songs`);
      process.exit(1);
    }

    generateFile(songs);

    console.log("\nNext steps:");
    console.log("  1. Delete server/gig.db (if it exists)");
    console.log("  2. Test locally:  npm start");
    console.log("  3. Push to GitHub and redeploy on Render");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
