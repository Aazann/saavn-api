import { HTTPException } from 'hono/http-exception';

export class JioSaavnAPI {
  private async request<T>({
    url,
  }: {
    url: string;
  }): Promise<{ data: T; ok: boolean }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new HTTPException(response.status, { message: 'Request failed' });
    }
    const data = await response.json();
    return { data: data as T, ok: response.ok };
  }

  async search(query: string): Promise<any> {
    const { data } = await this.request<any>({
      url: `https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&cc=in&ctx=web6dot0&includeMetaTags=1&q=${encodeURIComponent(query)}`,
    });
    if (!data?.results?.length) {
      throw new HTTPException(404, { message: `No results found for "${query}"` });
    }
    const results = data.results.map((track: any) => this.formatTrack(track));
    return { results };
  }

  async getTrackById(id: string): Promise<any> {
    const { data } = await this.request<any>({
      url: `https://www.jiosaavn.com/api.php?__call=song.getDetails&api_version=4&_format=json&_marker=0&ctx=web6dot0&pids=${encodeURIComponent(id)}`,
    });
    if (!data?.songs?.length) {
      throw new HTTPException(404, { message: 'Track not found' });
    }
    const track = this.formatTrack(data.songs[0]);
    return { track };
  }

  async getTrack(id: string): Promise<any> {
    const { data } = await this.request<any>({
      url: `https://www.jiosaavn.com/api.php?__call=webapi.get&api_version=4&_format=json&_marker=0&ctx=web6dot0&token=${encodeURIComponent(id)}&type=song`,
    });
    if (!data?.songs?.length) {
      throw new HTTPException(404, { message: 'Track not found' });
    }
    const track = this.formatTrack(data.songs[0]);
    return { track };
  }

  async getAlbum(id: string): Promise<any> {
    const { data } = await this.request<any>({
      url: `https://www.jiosaavn.com/api.php?__call=webapi.get&api_version=4&_format=json&_marker=0&ctx=web6dot0&token=${encodeURIComponent(id)}&type=album`,
    });
    if (!data) {
      throw new HTTPException(404, { message: 'Album not found' });
    }
    const album = this.formatAlbum(data);
    return { album };
  }

  async getArtist(id: string): Promise<any> {
    const { data } = await this.request<any>({
      url: `https://www.jiosaavn.com/api.php?__call=webapi.get&api_version=4&_format=json&_marker=0&ctx=web6dot0&token=${encodeURIComponent(id)}&type=artist&n_song=50`,
    });
    if (!data) {
      throw new HTTPException(404, { message: 'Artist not found' });
    }
    const artist = this.formatArtist(data);
    return { artist };
  }

  async getPlaylist(id: string, limit = 100): Promise<any> {
    const { data } = await this.request<any>({
      url: `https://www.jiosaavn.com/api.php?__call=webapi.get&api_version=4&_format=json&_marker=0&ctx=web6dot0&token=${encodeURIComponent(id)}&type=playlist&n=${limit}`,
    });
    if (!data) {
      throw new HTTPException(404, { message: 'Playlist not found' });
    }
    const playlist = this.formatPlaylist(data);
    return { playlist };
  }

  async getRecommendations(id: string, limit = 10): Promise<any> {
    const stationId = await this.getStation(id);
    if (!stationId) {
      throw new HTTPException(404, { message: 'No station ID found' });
    }
    const { data } = await this.request<any>({
      url: `https://www.jiosaavn.com/api.php?__call=webradio.getSong&api_version=4&_format=json&_marker=0&ctx=android&stationid=${stationId}&k=${limit}`,
    });
    const tracks = Object.values(data)
      .filter((item: any) => item.song)
      .map((item: any) => this.formatTrack(item.song));
    return { tracks };
  }

  private async getStation(identifier: string): Promise<string | null> {
    const encodedSongId = JSON.stringify([encodeURIComponent(identifier)]);
    const { data } = await this.request<any>({
      url: `https://www.jiosaavn.com/api.php?__call=webradio.createEntityStation&api_version=4&_format=json&_marker=0&ctx=android&entity_id=${encodedSongId}&entity_type=queue`,
    });
    return data?.stationid || null;
  }

  private formatTrack(track: any) {
    return {
      identifier: track.id,
      title: track.title,
      length: Number(track.more_info.duration) * 1000,
      uri: track.perma_url || null,
      artworkUrl: track.image.replace('150x150', '500x500'),
      author: track.more_info.artistMap?.primary_artists?.[0]?.name || null,
      encryptedMediaUrl: track.more_info.encrypted_media_url || null,
      albumUrl: track.more_info.album_url || null,
      artistUrl: track.more_info.artistMap?.primary_artists?.[0]?.perma_url || null,
      albumName: track.more_info.album || null,
      artistArtworkUrl: track.more_info.artistMap?.primary_artists?.[0]?.image?.replace('150x150', '500x500') || null,
    };
  }

  private formatAlbum(album: any) {
    return {
      id: album.id,
      name: album.title,
      uri: album.perma_url,
      artworkUrl: album.image.replace('150x150', '500x500'),
      author: album.subtitle,
      tracks: album.list.map((song: any) => this.formatTrack(song)),
      totalSongs: album.list_count,
    };
  }

  private formatArtist(artist: any): any {
    return {
      name: artist.name,
      uri: artist.urls.overview,
      artworkUrl: artist.image.replace('150x150', '500x500'),
      tracks: artist.topSongs.map((song: any) => this.formatTrack(song)),
    };
  }

  private formatPlaylist(playlist: any): any {
    return {
      title: playlist.title,
      uri: playlist.perma_url,
      artworkUrl: playlist.image.replace('150x150', '500x500'),
      tracks: playlist.list.map((song: any) => this.formatTrack(song)),
      totalSongs: playlist.list_count,
    };
  }

  extract = {
    track: (url: string) => this.extractEntity(url, /jiosaavn\.com\/song\/[^/]+\/([^/]+)$/),
    album: (url: string) => this.extractEntity(url, /jiosaavn\.com\/album\/[^/]+\/([^/]+)$/),
    artist: (url: string) => this.extractEntity(url, /jiosaavn\.com\/artist\/[^/]+\/([^/]+)$/),
    playlist: (url: string) => this.extractEntity(url, /(?:jiosaavn\.com|saavn\.com)\/(?:featured|s\/playlist)\/[^/]+\/([^/]+)$/),
  };

  private extractEntity(url: string, regex: RegExp): string | undefined {
    const match = url.match(regex);
    return match?.[1];
  }
}
