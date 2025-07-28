import type { Document, ObjectId } from 'mongoose';

// CS2 Match Types
export interface ICS2Match extends Document {
  hltvId: string;
  date: Date;
  tournament: {
    name: string;
    tier?: 'S' | 'A' | 'B' | 'C' | 'D';
    prizePool?: number;
    location?: string;
  };
  teams: Array<{
    team: ObjectId;
    score: number;
    side?: 'CT' | 'T';
    isWinner: boolean;
  }>;
  maps: Array<{
    name: string;
    pickBy?: ObjectId;
    winner?: ObjectId;
    score: {
      team1: number;
      team2: number;
    };
    rounds: Array<{
      number: number;
      winner?: 'CT' | 'T';
      reason?: 'elimination' | 'time' | 'bomb_defused' | 'bomb_exploded';
      ctScore: number;
      tScore: number;
      players: Array<{
        player?: ObjectId;
        kills: number;
        deaths: number;
        assists: number;
        damage: number;
        side?: 'CT' | 'T';
      }>;
    }>;
    playerStats: Array<{
      player?: ObjectId;
      kills: number;
      deaths: number;
      assists: number;
      adr: number;
      rating: number;
      kast: number;
    }>;
  }>;
  status: 'upcoming' | 'live' | 'finished';
  format: 'bo1' | 'bo3' | 'bo5';
  liveData?: {
    currentMap: number;
    currentRound: number;
    score: {
      team1: number;
      team2: number;
    };
    economy: {
      team1: number;
      team2: number;
    };
  };
  predictions: {
    halfTime: {
      predicted: boolean;
      winner?: ObjectId;
      confidence?: number;
      actualWinner?: ObjectId;
      factors: Array<{
        name?: string;
        weight?: number;
        value?: any;
      }>;
    };
    mapWinner: {
      predicted: boolean;
      winner?: ObjectId;
      confidence?: number;
      actualWinner?: ObjectId;
      factors: Array<{
        name?: string;
        weight?: number;
        value?: any;
      }>;
    };
    seriesOutcome: {
      predicted: boolean;
      outcome?: '2-0' | '2-1' | '3-0' | '3-1' | '3-2';
      winner?: ObjectId;
      confidence?: number;
      actualOutcome?: '2-0' | '2-1' | '3-0' | '3-1' | '3-2';
      actualWinner?: ObjectId;
      factors: Array<{
        name?: string;
        weight?: number;
        value?: any;
      }>;
    };
  };
  embeddings?: {
    teamPerformance?: number[];
    mapStats?: number[];
    playerMetrics?: number[];
    contextual?: number[];
  };
  metadata: {
    scrapedAt: Date;
    lastUpdated: Date;
    source: string;
    version: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// CS2 Team Types
export interface ICS2Team extends Document {
  hltvId: string;
  name: string;
  logo?: string;
  country?: string;
  ranking: {
    current?: number;
    peak?: number;
    points?: number;
    lastUpdated?: Date;
  };
  players: Array<{
    player: ObjectId;
    role?: 'IGL' | 'AWPer' | 'Entry' | 'Support' | 'Lurker';
    isActive: boolean;
    joinDate?: Date;
  }>;
  recentForm: Array<{
    matchId?: ObjectId;
    result: 0 | 1; // 0 = loss, 1 = win
    date?: Date;
    opponent?: ObjectId;
    mapScore?: string;
  }>;
  mapStats: Array<{
    mapName: string;
    wins: number;
    losses: number;
    winRate: number;
    avgRounds: number;
    lastPlayed?: Date;
  }>;
  statistics: {
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: number;
    avgRating: number;
    avgKD: number;
    avgADR: number;
    lastMatch?: Date;
  };
  achievements: Array<{
    tournament?: string;
    placement?: string;
    date?: Date;
    prizePool?: number;
  }>;
  embeddings?: {
    performance?: number[];
    mapSpecific?: number[];
    playerSynergy?: number[];
  };
  metadata: {
    scrapedAt: Date;
    lastUpdated: Date;
    source: string;
    isActive: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// CS2 Player Types
export interface ICS2Player extends Document {
  hltvId: string;
  nickname: string;
  realName?: string;
  country?: string;
  age?: number;
  photo?: string;
  currentTeam?: {
    team?: ObjectId;
    role?: 'IGL' | 'AWPer' | 'Entry' | 'Support' | 'Lurker';
    joinDate?: Date;
  };
  teamHistory: Array<{
    team?: ObjectId;
    startDate?: Date;
    endDate?: Date;
    role?: 'IGL' | 'AWPer' | 'Entry' | 'Support' | 'Lurker';
  }>;
  statistics: {
    overall: {
      rating: number;
      kills: number;
      deaths: number;
      assists: number;
      kd: number;
      adr: number;
      kast: number;
      impact: number;
      totalMaps: number;
      totalRounds: number;
    };
    recent: {
      rating: number;
      kd: number;
      adr: number;
      kast: number;
      mapsPlayed: number;
      timeframe: string;
      lastUpdated?: Date;
    };
  };
  mapStats: Array<{
    mapName: string;
    rating: number;
    kd: number;
    adr: number;
    kast: number;
    mapsPlayed: number;
    winRate: number;
  }>;
  weaponStats: {
    rifle: {
      kills: number;
      accuracy: number;
      headshotRate: number;
    };
    awp: {
      kills: number;
      accuracy: number;
      killsPerRound: number;
    };
    pistol: {
      kills: number;
      accuracy: number;
      roundWinRate: number;
    };
  };
  achievements: Array<{
    tournament?: string;
    placement?: string;
    date?: Date;
    mvp: boolean;
  }>;
  embeddings?: {
    performance?: number[];
    playstyle?: number[];
    clutchAbility?: number[];
  };
  metadata: {
    scrapedAt: Date;
    lastUpdated: Date;
    source: string;
    isActive: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}