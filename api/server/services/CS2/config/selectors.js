/**
 * CSS Selectors for HLTV Scraping
 */

const MATCH_SELECTORS = {
  primary: {
    matchElements: '.upcomingMatch, .result-con, .liveMatch',
    matchLink: 'a[href*="/matches/"]',
    teamName: '.teamName, .team-name',
    matchTime: '.matchTime, .time',
    matchEvent: '.matchEvent, .event',
    matchScore: '.matchMeta, .result-score',
    liveIndicator: '.live',
  },
  fallback: {
    matchElements: '.match, .match-item, .upcoming-match',
    matchLink: 'a[href*="matches"]',
    teamName: '.team .name, .team-title, .teamname',
    matchTime: '.time, .match-time, .date',
    matchEvent: '.event, .tournament, .match-event',
    matchScore: '.score, .result, .match-score',
    liveIndicator: '.live, .status-live',
  },
};

const TEAM_SELECTORS = {
  primary: {
    teamName: '.profile-team-name, .team-name',
    ranking: '.profile-team-stat .right, .ranking',
    players: '.bodyshot-team .player, .player-container .player',
    playerName: '.player-nick, .player-name',
    playerFlag: '.flag',
    recentMatches: '.recent-results .result, .match-result',
    teamLogo: '.team-logo, .logo',
  },
  fallback: {
    teamName: '.team-title, .teamname, h1',
    ranking: '.rank, .team-rank, .position',
    players: '.lineup .player, .roster .player, .team-player',
    playerName: '.name, .nick, .player-title',
    playerFlag: '.country, .flag-icon',
    recentMatches: '.results .match, .match-history .match',
    teamLogo: 'img[alt*="logo"], .team-image',
  },
};

const PLAYER_SELECTORS = {
  primary: {
    playerName: '.playerNickname, .player-name',
    realName: '.playerRealname, .real-name',
    age: '.playerAge, .age',
    country: '.flag, .country',
    team: '.team-info .team-name, .current-team',
    playerImage: '.playerPicture img, .player-image',
    stats: '.stats-row, .player-stat',
    statLabel: '.stats-row-label, .stat-label',
    statValue: '.stats-row-value, .stat-value',
    achievements: '.achievement, .trophy',
  },
  fallback: {
    playerName: '.player-title, .nickname, h1',
    realName: '.real-name, .full-name',
    age: '.player-age, .age-info',
    country: '.flag-icon, .nationality',
    team: '.team-name, .current-team-name',
    playerImage: '.player-photo img, .profile-image',
    stats: '.statistic, .player-statistic',
    statLabel: '.label, .name',
    statValue: '.value, .number',
    achievements: '.award, .achievement-item',
  },
};

module.exports = {
  MATCH_SELECTORS,
  TEAM_SELECTORS,
  PLAYER_SELECTORS,
};