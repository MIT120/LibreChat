import { Schema } from 'mongoose';
import type { ICS2Player } from '~/types';

const cs2PlayerSchema = new Schema<ICS2Player>(
  {
    hltvId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    nickname: {
      type: String,
      required: true,
      index: true,
    },
    realName: {
      type: String,
    },
    country: {
      type: String,
    },
    age: {
      type: Number,
    },
    photo: {
      type: String,
    },
    currentTeam: {
      team: {
        type: Schema.Types.ObjectId,
        ref: 'CS2Team',
      },
      role: {
        type: String,
        enum: ['IGL', 'AWPer', 'Entry', 'Support', 'Lurker'],
      },
      joinDate: {
        type: Date,
      },
    },
    teamHistory: [
      {
        team: {
          type: Schema.Types.ObjectId,
          ref: 'CS2Team',
        },
        startDate: {
          type: Date,
        },
        endDate: {
          type: Date,
        },
        role: {
          type: String,
          enum: ['IGL', 'AWPer', 'Entry', 'Support', 'Lurker'],
        },
      },
    ],
    statistics: {
      overall: {
        rating: {
          type: Number,
          default: 0,
        },
        kills: {
          type: Number,
          default: 0,
        },
        deaths: {
          type: Number,
          default: 0,
        },
        assists: {
          type: Number,
          default: 0,
        },
        kd: {
          type: Number,
          default: 0,
        },
        adr: {
          type: Number,
          default: 0,
        },
        kast: {
          type: Number,
          default: 0,
        },
        impact: {
          type: Number,
          default: 0,
        },
        totalMaps: {
          type: Number,
          default: 0,
        },
        totalRounds: {
          type: Number,
          default: 0,
        },
      },
      recent: {
        rating: {
          type: Number,
          default: 0,
        },
        kd: {
          type: Number,
          default: 0,
        },
        adr: {
          type: Number,
          default: 0,
        },
        kast: {
          type: Number,
          default: 0,
        },
        mapsPlayed: {
          type: Number,
          default: 0,
        },
        timeframe: {
          type: String,
          default: '3months',
        },
        lastUpdated: {
          type: Date,
        },
      },
    },
    mapStats: [
      {
        mapName: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          default: 0,
        },
        kd: {
          type: Number,
          default: 0,
        },
        adr: {
          type: Number,
          default: 0,
        },
        kast: {
          type: Number,
          default: 0,
        },
        mapsPlayed: {
          type: Number,
          default: 0,
        },
        winRate: {
          type: Number,
          default: 0,
        },
      },
    ],
    weaponStats: {
      rifle: {
        kills: {
          type: Number,
          default: 0,
        },
        accuracy: {
          type: Number,
          default: 0,
        },
        headshotRate: {
          type: Number,
          default: 0,
        },
      },
      awp: {
        kills: {
          type: Number,
          default: 0,
        },
        accuracy: {
          type: Number,
          default: 0,
        },
        killsPerRound: {
          type: Number,
          default: 0,
        },
      },
      pistol: {
        kills: {
          type: Number,
          default: 0,
        },
        accuracy: {
          type: Number,
          default: 0,
        },
        roundWinRate: {
          type: Number,
          default: 0,
        },
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
        mvp: {
          type: Boolean,
          default: false,
        },
      },
    ],
    embeddings: {
      performance: {
        type: [Number],
        default: undefined,
      },
      playstyle: {
        type: [Number],
        default: undefined,
      },
      clutchAbility: {
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
cs2PlayerSchema.index({ nickname: 1 });
cs2PlayerSchema.index({ 'statistics.overall.rating': -1 });
cs2PlayerSchema.index({ 'currentTeam.team': 1 });
cs2PlayerSchema.index({ country: 1 });
cs2PlayerSchema.index({ hltvId: 1 }, { unique: true });
cs2PlayerSchema.index({ 'metadata.isActive': 1, 'statistics.overall.rating': -1 });

export default cs2PlayerSchema;
