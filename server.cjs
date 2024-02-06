// Handle Riot API request
const express = require('express');
const axios = require('axios');
const app = express();
const helmet = require('helmet');
const port = process.env.RAILWAY_PORT || 3000;
const apiKey = 'RGAPI-19840061-d645-4c33-a52c-a98a8c117b51';

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https://ddragon.leagueoflegends.com", "data:"],
    },
  })
);

app.use(express.static('rank-icons'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/riot-api', async (req, res) => {
  const summonerName = req.query.summonerName;
  const spinnerValue = req.query.spinnerValue;
  const gameMode = req.query.gameMode;

  try {
    const response = await axios.get(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`, {
      headers: {
        'X-Riot-Token': apiKey
      }
    });

    const summonerData = response.data;

    // Fetch ranked information using the summoner's ID
    const rankedResponse = await axios.get(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`, {
      headers: {
        'X-Riot-Token': apiKey
      }
    });
    const rankInfo = rankedResponse.data.find(entry => entry.queueType === "RANKED_SOLO_5x5");

    

    // Fetch the current game version
    const versionResponse = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
    const gameVersion = versionResponse.data[0]; // Assuming the first version is the current one


    // Fetch champion mastery data
    const championMasteryResponse = await axios.get(`https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${summonerData.puuid}/top?count=3&`, {
  headers: {
    'X-Riot-Token': apiKey
  }
});

const championList = championMasteryResponse.data;

// Fetch champion names and map the data
const championInfo = await Promise.all(
  championList.map(async (champion) => {
    const championId = champion.championId.toString(); // Convert ID to a string

    try {
      const championMasteryData = await axios.get(
        `https://ddragon.leagueoflegends.com/cdn/${gameVersion}/data/en_US/champion.json`
      );
      const championData = championMasteryData.data.data;

      const matchingChampion = Object.values(championData).find(
        (champ) => champ.key === championId
      );

      if (matchingChampion) {
        const championName = matchingChampion.name;

        return {
          championName: championName,
          championPoints: champion.championPoints,
          championLevel: champion.championLevel,
          
        };
      } else {
        return {
          championName: 'Champion Not Found',
          championPoints: champion.championPoints,
          championLevel: champion.championLevel,
          
        };
      }
    } catch (error) {
      console.error(error);
      return {
        championName: 'Error Fetching Champion Data',
        championPoints: champion.championPoints,
        championLevel: champion.championLevel,
        
      };
    }
  })
);


// Fetch the last 2 match IDs based on the determined match type
const lastMatchesResponse = await axios.get(`https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${summonerData.puuid}/ids?queue=${gameMode}&start=0&count=${spinnerValue}`, {
  headers: {
    'X-Riot-Token': apiKey
  }
});


    const lastMatchIds = lastMatchesResponse.data;

    // Fetch details for each match
    const lastMatchesDetails = await Promise.all(
      lastMatchIds.map(async (matchId) => {
        try {
          const matchDetailsResponse = await axios.get(`https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`, {
            headers: {
              'X-Riot-Token': apiKey
            }
          });

          // Extract participant stats for the summoner from the match details
          const participant = matchDetailsResponse.data.info.participants.find((participant) => participant.puuid === summonerData.puuid);
          const championId = participant.championId.toString();
          const kills = participant.kills.toString();
          const deaths = participant.deaths.toString();
          const assists = participant.assists.toString();
          const item0 = participant.item0.toString();
          const item1 = participant.item1.toString();
          const item2 = participant.item2.toString();
          const item3 = participant.item3.toString();
          const item4 = participant.item4.toString();
          const item5 = participant.item5.toString();
          const cs = participant.totalMinionsKilled.toString();

          // Fetch champion name using the champion ID
          const championMasteryData = await axios.get(
            `https://ddragon.leagueoflegends.com/cdn/${gameVersion}/data/en_US/champion.json`
          );
          const championData = championMasteryData.data.data;
          const matchingChampion = Object.values(championData).find((champ) => champ.key === championId);

          const championName = matchingChampion ? matchingChampion.name : 'Champion Not Found';

          return {
            matchId: matchId,
            championName: championName,
            kills: kills,
            deaths: deaths,
            assists: assists,
            item0: item0,
            item1: item1,
            item2: item2,
            item3: item3,
            item4: item4,
            item5: item5,
            cs: cs,
          };
        } catch (error) {
          console.error(error);
          return {
            matchId: matchId,
            championName: 'Error Fetching Match Data',
            kills: 0,
            deaths: 0,
            assists: 0,
            
          };
        }
      })
    );

    // Send back the combined data
res.json({
  rankTier: rankInfo && rankInfo.tier !== 'No Rank' ? `${rankInfo.tier}` : 'No Rank',
  rankInfo: rankInfo && rankInfo.tier !== 'No Rank' ? `Rank: ${rankInfo.tier} ${rankInfo.rank}` : 'No Rank',
  championList: championInfo,
  winrate: rankInfo && rankInfo.losses !== 0
    ? ((Number(rankInfo.wins) / (Number(rankInfo.losses) + Number(rankInfo.wins))) * 100).toFixed(2)
    : "N/A",
  lastMatches: lastMatchesDetails,
  gameVersion: gameVersion.toString(),
});


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while making the API request.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
