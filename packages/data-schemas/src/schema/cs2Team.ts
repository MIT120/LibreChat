import { Schema } from 'mongoose';
import type { ICS2Team } from '~/types';

const cs2TeamSchema = new Schema<ICS2Team>(
  {
    hltvId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
    },
    country: {
      type: String,
    },
    ranking: {
      current: {
        type: Number,
      },
      peak: {
        type: Number,
      },
      points: {
        type: Number,
      },
      lastUpdated: {
        type: Date,
      },
    },
    players: [
      {
        player: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Player',
          required: true,
        },
        role: {
          type: String,
          enum: ['IGL', 'AWPer', 'Entry', 'Support', 'Lurker'],
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        joinDate: {
          type: Date,
        },
      },
    ],
    recentForm: [
      {
        matchId: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Match',
        },
        result: {
          type: Number,
          enum: [0, 1], // 0 = loss, 1 = win
        },
        date: {
          type: Date,
        },
        opponent: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        mapScore: {
          type: String, // e.g., "16-12", "2-1"
        },
      },
    ],
    mapStats: [
      {
        mapName: {
          type: String,
          required: true,
        },
        wins: {
          type: Number,
          default: 0,
        },
        losses: {
          type: Number,
          default: 0,
        },
        winRate: {
          type: Number,
          default: 0,
        },
        avgRounds: {
          type: Number,
          default: 0,
        },
        lastPlayed: {
          type: Date,
        },
      },
    ],
    statistics: {
      totalMatches: {
        type: Number,
        default: 0,
      },
      wins: {
        type: Number,
        default: 0,
      },
      losses: {
        type: Number,
        default: 0,
      },
      winRate: {
        type: Number,
        default: 0,
      },
      avgRating: {
        type: Number,
        default: 0,
      },
      avgKD: {
        type: Number,
        default: 0,
      },
      avgADR: {
        type: Number,
        default: 0,
      },
      lastMatch: {
        type: Date,
      },
    },
    achievements: [
      {
        tournament: {
          type: String,
        },
        placement: {
          type: String, // e.g., "1st", "2nd", "3-4th"
        },
        date: {
          type: Date,
        },
        prizePool: {
          type: Number,
        },
      },
    ],
    embeddings: {
      performance: {
        type: [Number],
        default: undefined,
      },
      mapSpecific: {
        type: [Number],
        default: undefined,
      },
      playerSynergy: {
        type: [Number],
        default: undefined,
      },
    },
    metadata: {
      scrapedAt: {
        type: Date,
        default: Date.now,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
      source: {
        type: String,
        default: 'HLTV',
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
cs2TeamSchema.index({ name: 1 });
cs2TeamSchema.index({ 'ranking.current': 1 });
cs2TeamSchema.index({ country: 1 });
cs2TeamSchema.index({ hltvId: 1 }, { unique: true });
cs2TeamSchema.index({ 'metadata.isActive': 1, 'ranking.current': 1 });

export default cs2TeamSchema;
