const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const ITUNES_SEARCH_BASE = "https://itunes.apple.com/search";
const APPLE_RSS_BASE = "https://rss.applemarketingtools.com/api/v2";
const SPOTIFY_MARKET = process.env.SPOTIFY_MARKET || "IN";
const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative"
].join(" ");

let tokenCache = {
  accessToken: null,
  expiresAt: 0
};
const importCache = new Map();

const APPLE_CURATED_PRESETS = {
  india: {
    key: "india",
    label: "Top 100: India",
    country: "in"
  },
  usa: {
    key: "usa",
    label: "Top 100: USA",
    country: "us"
  },
  uk: {
    key: "uk",
    label: "Top 100: UK",
    country: "gb"
  },
  canada: {
    key: "canada",
    label: "Top 100: Canada",
    country: "ca"
  },
  australia: {
    key: "australia",
    label: "Top 100: Australia",
    country: "au"
  }
};

function extractPlaylistId(playlistUrl) {
  const directMatch = playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/);

  if (directMatch) {
    return directMatch[1];
  }

  if (/^[a-zA-Z0-9]+$/.test(playlistUrl)) {
    return playlistUrl;
  }

  throw new Error("Invalid Spotify playlist URL.");
}

function normalizeCuratedQuery(query) {
  const normalized = (query || "").trim().toLowerCase();

  if (!normalized) {
    throw new Error("Enter an Apple curated chart name like India or USA.");
  }

  const direct = APPLE_CURATED_PRESETS[normalized];

  if (direct) {
    return direct;
  }

  const fuzzy = Object.values(APPLE_CURATED_PRESETS).find((preset) =>
    preset.label.toLowerCase().includes(normalized)
  );

  if (fuzzy) {
    return fuzzy;
  }

  throw new Error("Apple curated playlist not found. Try India, USA, UK, Canada, or Australia.");
}

async function getSpotifyToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Spotify credentials in server/.env.");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to authenticate with Spotify (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000
  };

  return tokenCache.accessToken;
}

async function refreshUserToken(refreshToken) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Spotify token (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000
  };
}

export function createSpotifyAuthUrl(state) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing Spotify OAuth configuration in server/.env.");
  }

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("show_dialog", "true");

  return url.toString();
}

export async function exchangeCodeForTokens(code) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange Spotify code (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000
  };
}

async function resolveAccessToken(userTokens) {
  if (userTokens) {
    if (Date.now() < userTokens.expiresAt) {
      return {
        accessToken: userTokens.accessToken,
        tokens: userTokens
      };
    }

    if (!userTokens.refreshToken) {
      throw new Error("Spotify session expired. Reconnect Spotify and try again.");
    }

    const refreshed = await refreshUserToken(userTokens.refreshToken);

    return {
      accessToken: refreshed.accessToken,
      tokens: refreshed
    };
  }

  return {
    accessToken: await getSpotifyToken(),
    tokens: null
  };
}

async function spotifyGet(pathname, searchParams = {}, userTokens = null) {
  const tokenState = await resolveAccessToken(userTokens);
  const token = tokenState.accessToken;
  const url = new URL(`${SPOTIFY_API_BASE}${pathname}`);

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403 && pathname.includes("/playlists/")) {
      throw new Error(
        "Spotify blocked this playlist for the current app session. Try a playlist you own, duplicate it into your account, or re-import one that already worked."
      );
    }
    throw new Error(`Spotify request failed (${response.status}) for ${pathname}: ${errorText}`);
  }

  const data = await response.json();

  return {
    data,
    tokens: tokenState.tokens
  };
}

async function fetchPlaylistTracks(playlistId, userTokens) {
  const collected = [];
  let offset = 0;
  let hasMore = true;
  let latestTokens = userTokens;

  while (hasMore) {
    const response = await spotifyGet(`/playlists/${playlistId}/items`, {
      limit: 100,
      offset,
      market: SPOTIFY_MARKET,
      additional_types: "track"
    }, latestTokens);
    const data = response.data;
    latestTokens = response.tokens || latestTokens;

    collected.push(...(data.items || []));
    offset += 100;
    hasMore = Boolean(data.next);
  }

  return {
    items: collected,
    tokens: latestTokens
  };
}

async function searchAppleMusicLink(title, artist) {
  const url = new URL(ITUNES_SEARCH_BASE);
  url.searchParams.set("term", `${title} ${artist}`);
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "1");

  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Apple search request failed for "${title} — ${artist}": ${error.message}`);
  }

  if (!response.ok) {
    return "";
  }

  const data = await response.json();
  return data.results?.[0]?.trackViewUrl || "";
}

function extractSpotifyTrack(item) {
  const candidate = item?.track || item?.item || item;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  if (candidate.type && candidate.type !== "track") {
    return null;
  }

  if (!candidate.id || !candidate.name) {
    return null;
  }

  return candidate;
}

function normalizeTrack(track) {
  return {
    id: track.id,
    title: track.name,
    artist: track.artists?.map((artist) => artist.name).join(", ") || "Unknown Artist",
    preview_url: "",
    cover: track.album?.images?.[0]?.url || "",
    lyricSnippet: "",
    apple_music_url: ""
  };
}

async function enrichAppleLinks(songs) {
  return Promise.all(
    songs.map(async (song) => {
      const url = new URL(ITUNES_SEARCH_BASE);
      url.searchParams.set("term", `${song.title} ${song.artist}`);
      url.searchParams.set("entity", "song");
      url.searchParams.set("limit", "5");

      let response;

      try {
        response = await fetch(url);
      } catch (error) {
        return {
          ...song,
          appleLookupError: `Apple search request failed for "${song.title} — ${song.artist}": ${error.message}`
        };
      }

      if (!response.ok) {
        return {
          ...song,
          appleLookupError: `Apple search request returned ${response.status} for "${song.title} — ${song.artist}".`
        };
      }

      const data = await response.json();
      const normalizedSongTitle = song.title.toLowerCase();
      const normalizedArtist = song.artist.toLowerCase();
      const bestMatch =
        data.results?.find((result) => {
          const trackName = (result.trackName || "").toLowerCase();
          const artistName = (result.artistName || "").toLowerCase();

          return (
            trackName.includes(normalizedSongTitle) ||
            normalizedSongTitle.includes(trackName) ||
            artistName.includes(normalizedArtist.split(",")[0]?.trim() || "")
          );
        }) || data.results?.[0];

      return {
        ...song,
        preview_url: bestMatch?.previewUrl || "",
        cover:
          bestMatch?.artworkUrl100?.replace("100x100bb", "512x512bb") ||
          song.cover,
        apple_music_url: bestMatch?.trackViewUrl || "",
        appleMatchTitle: bestMatch?.trackName || "",
        appleMatchArtist: bestMatch?.artistName || "",
        appleLookupError: bestMatch?.previewUrl ? "" : `No Apple preview match for "${song.title} — ${song.artist}".`
      };
    })
  );
}

async function fetchAppleCuratedFeed(preset) {
  const url = `${APPLE_RSS_BASE}/${preset.country}/music/most-played/100/songs.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Apple curated feed request failed (${response.status}) for ${preset.label}.`);
  }

  const data = await response.json();

  return (data.feed?.results || []).map((entry) => ({
    id: entry.id,
    title: entry.name,
    artist: entry.artistName,
    preview_url: "",
    cover: entry.artworkUrl100?.replace("100x100bb", "512x512bb") || "",
    apple_music_url: entry.url || "",
    lyricSnippet: ""
  }));
}

export async function importSpotifyPlaylist(playlistUrl, userTokens) {
  const cacheKey = `spotify:${playlistUrl.trim()}`;
  const cached = importCache.get(cacheKey);

  if (cached) {
    return {
      ...cached,
      tokens: userTokens
    };
  }

  const playlistId = extractPlaylistId(playlistUrl);
  const playlistResponse = await spotifyGet(`/playlists/${playlistId}`, {
    fields: "name,images",
    market: SPOTIFY_MARKET
  }, userTokens);
  const playlist = playlistResponse.data;
  const trackResponse = await fetchPlaylistTracks(playlistId, playlistResponse.tokens || userTokens);
  const tracks = trackResponse.items;
  const extractedTracks = tracks.map(extractSpotifyTrack).filter(Boolean);

  const spotifyTracks = extractedTracks.map(normalizeTrack);
  const matchedTracks = await enrichAppleLinks(spotifyTracks);
  const playableTracks = matchedTracks.filter((track) => track.preview_url);

  if (playableTracks.length < 4) {
    const sampleErrors = matchedTracks
      .filter((track) => track.appleLookupError)
      .slice(0, 3)
      .map((track) => track.appleLookupError)
      .join(" | ");
    const firstItem = tracks[0] || null;
    const firstCandidate = firstItem?.track || firstItem || null;
    const itemKeys = firstItem ? Object.keys(firstItem).slice(0, 12).join(", ") : "none";
    const candidateKeys = firstCandidate
      ? Object.keys(firstCandidate).slice(0, 16).join(", ")
      : "none";
    const examples = matchedTracks
      .filter((track) => !track.preview_url)
      .slice(0, 5)
      .map((track) => `${track.title} — ${track.artist}`)
      .join(", ");

    throw new Error(
      `This playlist returned ${tracks.length} Spotify items, ${spotifyTracks.length} usable Spotify tracks, and ${playableTracks.length} Apple preview matches. First item keys: [${itemKeys}]. First track keys: [${candidateKeys}]. Sample misses: ${examples || "none"}. Apple lookup notes: ${sampleErrors || "none"}.`
    );
  }

  const imported = {
    playlistName: playlist.name,
    playlistCover: playlist.images?.[0]?.url || playableTracks[0]?.cover || "",
    songs: playableTracks,
    sourceTrackCount: spotifyTracks.length,
    tokens: trackResponse.tokens || playlistResponse.tokens || userTokens
  };

  importCache.set(cacheKey, {
    playlistName: imported.playlistName,
    playlistCover: imported.playlistCover,
    songs: imported.songs,
    sourceTrackCount: imported.sourceTrackCount
  });

  return imported;
}

export async function importAppleCuratedPlaylist(query) {
  const cacheKey = `apple_curated:${query.trim().toLowerCase()}`;
  const cached = importCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const preset = normalizeCuratedQuery(query);
  const feedSongs = await fetchAppleCuratedFeed(preset);
  const playableTracks = (await enrichAppleLinks(feedSongs)).filter((track) => track.preview_url);

  if (playableTracks.length < 4) {
    throw new Error(`${preset.label} only has ${playableTracks.length} playable Apple previews right now.`);
  }

  const imported = {
    playlistName: preset.label,
    playlistCover: playableTracks[0]?.cover || "",
    songs: playableTracks,
    sourceTrackCount: feedSongs.length,
    source: "apple_curated"
  };

  importCache.set(cacheKey, imported);

  return imported;
}

export function listAppleCuratedPlaylists() {
  return Object.values(APPLE_CURATED_PRESETS).map(({ key, label }) => ({ key, label }));
}

export async function fetchDefaultModeTracks(mode) {
  const modeMap = {
    Pop: "genre:pop",
    Rock: "genre:rock",
    "Top Hits": "year:2024"
  };

  const query = modeMap[mode] || modeMap["Top Hits"];
  const response = await spotifyGet("/search", {
    q: query,
    type: "track",
    limit: 24,
    market: SPOTIFY_MARKET
  });
  const results = response.data;

  const spotifyTracks = (results.tracks?.items || [])
    .filter((track) => track?.id && track?.name)
    .map(normalizeTrack);
  const playableTracks = (await enrichAppleLinks(spotifyTracks)).filter((track) => track.preview_url);

  if (playableTracks.length < 4) {
    throw new Error(`Could not load enough Apple preview tracks for ${mode}.`);
  }

  return playableTracks;
}
