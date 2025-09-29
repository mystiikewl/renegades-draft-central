// Mock data for the Renegades NBA Fantasy Draft

export interface Player {
  id: string;
  name: string;
  position: string;
  nbaTeam: string;
  isDrafted?: boolean;
}

export interface DraftPick {
  round: number;
  pick: number;
  overallPick: number;
  team: string;
  player?: {
    name: string;
    position: string;
    nbaTeam: string;
  };
}

export const teams = [
  "Lakers", "Warriors", "Celtics", "Heat", "Knicks",
  "Nuggets", "Suns", "Bucks", "76ers", "Mavs"
];

export const mockPlayers: Player[] = [
  { id: "1", name: "Nikola Jokić", position: "C", nbaTeam: "DEN" },
  { id: "2", name: "Luka Dončić", position: "PG/SG", nbaTeam: "DAL" },
  { id: "3", name: "Giannis Antetokounmpo", position: "PF/C", nbaTeam: "MIL" },
  { id: "4", name: "Shai Gilgeous-Alexander", position: "PG/SG", nbaTeam: "OKC" },
  { id: "5", name: "Jayson Tatum", position: "SF/PF", nbaTeam: "BOS" },
  { id: "6", name: "LeBron James", position: "SF/PF", nbaTeam: "LAL" },
  { id: "7", name: "Stephen Curry", position: "PG", nbaTeam: "GSW" },
  { id: "8", name: "Kevin Durant", position: "SF/PF", nbaTeam: "PHX" },
  { id: "9", name: "Joel Embiid", position: "C", nbaTeam: "PHI" },
  { id: "10", name: "Jaylen Brown", position: "SG/SF", nbaTeam: "BOS" },
  { id: "11", name: "Devin Booker", position: "SG", nbaTeam: "PHX" },
  { id: "12", name: "Tyrese Haliburton", position: "PG", nbaTeam: "IND" },
  { id: "13", name: "Anthony Davis", position: "PF/C", nbaTeam: "LAL" },
  { id: "14", name: "Damian Lillard", position: "PG", nbaTeam: "MIL" },
  { id: "15", name: "Ja Morant", position: "PG", nbaTeam: "MEM" },
  { id: "16", name: "Paolo Banchero", position: "PF", nbaTeam: "ORL" },
  { id: "17", name: "Scottie Barnes", position: "SF/PF", nbaTeam: "TOR" },
  { id: "18", name: "Franz Wagner", position: "SF", nbaTeam: "ORL" },
  { id: "19", name: "Alperen Şengün", position: "C", nbaTeam: "HOU" },
  { id: "20", name: "Chet Holmgren", position: "PF/C", nbaTeam: "OKC" },
  { id: "21", name: "Victor Wembanyama", position: "C", nbaTeam: "SAS" },
  { id: "22", name: "Donovan Mitchell", position: "SG", nbaTeam: "CLE" },
  { id: "23", name: "Zion Williamson", position: "PF", nbaTeam: "NOP" },
  { id: "24", name: "Kawhi Leonard", position: "SF", nbaTeam: "LAC" },
  { id: "25", name: "Paul George", position: "SF/SG", nbaTeam: "LAC" },
  { id: "26", name: "Jimmy Butler", position: "SF/SG", nbaTeam: "MIA" },
  { id: "27", name: "Bam Adebayo", position: "C", nbaTeam: "MIA" },
  { id: "28", name: "Rudy Gobert", position: "C", nbaTeam: "MIN" },
  { id: "29", name: "Karl-Anthony Towns", position: "C", nbaTeam: "NYK" },
  { id: "30", name: "Jalen Green", position: "SG", nbaTeam: "HOU" },
  { id: "31", name: "Evan Mobley", position: "PF/C", nbaTeam: "CLE" },
  { id: "32", name: "Anfernee Simons", position: "SG", nbaTeam: "POR" },
  { id: "33", name: "Tyler Herro", position: "SG", nbaTeam: "MIA" },
  { id: "34", name: "Darius Garland", position: "PG", nbaTeam: "CLE" },
  { id: "35", name: "LaMelo Ball", position: "PG", nbaTeam: "CHA" },
  { id: "36", name: "Trae Young", position: "PG", nbaTeam: "ATL" },
  { id: "37", name: "De'Aaron Fox", position: "PG", nbaTeam: "SAC" },
  { id: "38", name: "Jalen Brunson", position: "PG", nbaTeam: "NYK" },
  { id: "39", name: "RJ Barrett", position: "SG/SF", nbaTeam: "TOR" },
  { id: "40", name: "OG Anunoby", position: "SF/PF", nbaTeam: "NYK" },
  { id: "41", name: "Mikal Bridges", position: "SF", nbaTeam: "NYK" },
  { id: "42", name: "Jarrett Allen", position: "C", nbaTeam: "CLE" },
  { id: "43", name: "Domantas Sabonis", position: "C", nbaTeam: "SAC" },
  { id: "44", name: "Pascal Siakam", position: "PF", nbaTeam: "IND" },
  { id: "45", name: "Julius Randle", position: "PF", nbaTeam: "NYK" },
  { id: "46", name: "Brandon Ingram", position: "SF", nbaTeam: "NOP" },
  { id: "47", name: "CJ McCollum", position: "SG", nbaTeam: "NOP" },
  { id: "48", name: "Fred VanVleet", position: "PG", nbaTeam: "HOU" },
  { id: "49", name: "Jrue Holiday", position: "PG/SG", nbaTeam: "BOS" },
  { id: "50", name: "Kristaps Porziņģis", position: "PF/C", nbaTeam: "BOS" }
];

// Generate initial draft picks (empty, ready for drafting)
export const generateInitialDraftPicks = (): DraftPick[] => {
  const picks: DraftPick[] = [];
  const rounds = 15; // Standard fantasy basketball rounds
  
  for (let round = 1; round <= rounds; round++) {
    for (let pick = 1; pick <= teams.length; pick++) {
      const isEvenRound = round % 2 === 0;
      const teamIndex = isEvenRound ? teams.length - pick : pick - 1;
      const overallPick = (round - 1) * teams.length + pick;
      
      picks.push({
        round,
        pick,
        overallPick,
        team: teams[teamIndex]
      });
    }
  }
  
  return picks;
};