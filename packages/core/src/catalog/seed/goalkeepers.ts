import type { SeedPlayer } from '../seedTypes';

/**
 * Goalkeepers, each in his PRIME version.
 * f = [diving, handling, kicking, reflexes, speed, positioning]
 */
export const GOALKEEPERS: SeedPlayer[] = [
  // ───────────────────────────── Legends ─────────────────────────────
  {
    n: 'Gianluigi Buffon', nat: 'ITA', pos: 'GK', prime: '2002-2006', club: 'Juventus', era: '2000s',
    foot: 'R', h: 192, style: 'shot_stopper', ovr: 94, f: [92, 90, 76, 95, 60, 94],
    tags: ['legend', 'world_cup', 'serie_a', 'italia'],
  },
  {
    n: 'Iker Casillas', nat: 'ESP', pos: 'GK', prime: '2007-2010', club: 'Real Madrid', era: '2000s',
    foot: 'R', h: 185, style: 'shot_stopper', ovr: 92, f: [94, 85, 70, 97, 70, 89],
    tags: ['legend', 'world_cup', 'champions', 'laliga'],
  },
  {
    n: 'Oliver Kahn', nat: 'GER', pos: 'GK', prime: '2000-2002', club: 'Bayern München', era: '2000s',
    foot: 'R', h: 188, style: 'shot_stopper', ovr: 91, f: [90, 89, 72, 93, 62, 92],
    tags: ['legend', 'world_cup', 'champions', 'bundesliga'],
  },
  {
    n: 'Peter Schmeichel', nat: 'DEN', pos: 'GK', prime: '1993-1999', club: 'Manchester United', era: '90s',
    foot: 'R', h: 191, style: 'shot_stopper', ovr: 91, f: [89, 87, 80, 93, 64, 91],
    tags: ['legend', 'champions', 'premier'],
  },
  {
    n: 'Dino Zoff', nat: 'ITA', pos: 'GK', prime: '1973-1978', club: 'Juventus', era: '70s',
    foot: 'R', h: 182, style: 'shot_stopper', ovr: 90, f: [86, 90, 65, 87, 55, 93],
    tags: ['legend', 'world_cup', 'serie_a', 'italia'],
  },
  {
    n: 'Petr Čech', nat: 'CZE', pos: 'GK', prime: '2004-2008', club: 'Chelsea', era: '2000s',
    foot: 'L', h: 196, style: 'shot_stopper', ovr: 90, f: [88, 89, 70, 90, 58, 92],
    tags: ['legend', 'champions', 'premier'],
  },
  {
    n: 'Walter Zenga', nat: 'ITA', pos: 'GK', prime: '1987-1991', club: 'Inter', era: '80s',
    foot: 'R', h: 188, style: 'shot_stopper', ovr: 88, f: [90, 83, 70, 91, 68, 86],
    tags: ['legend', 'serie_a', 'italia', 'cult'],
  },
  {
    n: 'Edwin van der Sar', nat: 'NED', pos: 'GK', prime: '2007-2009', club: 'Manchester United', era: '2000s',
    foot: 'R', h: 197, style: 'shot_stopper', ovr: 88, f: [85, 88, 84, 86, 58, 91],
    tags: ['legend', 'champions', 'premier'],
  },
  {
    n: 'Júlio César', nat: 'BRA', pos: 'GK', prime: '2008-2010', club: 'Inter', era: '2000s',
    foot: 'R', h: 186, style: 'shot_stopper', ovr: 88, f: [89, 85, 70, 90, 65, 87],
    tags: ['legend', 'champions', 'serie_a'],
  },
  {
    n: 'Angelo Peruzzi', nat: 'ITA', pos: 'GK', prime: '1995-1998', club: 'Juventus', era: '90s',
    foot: 'R', h: 181, style: 'shot_stopper', ovr: 87, f: [86, 87, 66, 89, 58, 88],
    tags: ['legend', 'champions', 'serie_a', 'italia'],
  },
  {
    n: 'Dida', nat: 'BRA', pos: 'GK', prime: '2003-2005', club: 'Milan', era: '2000s',
    foot: 'R', h: 195, style: 'shot_stopper', ovr: 86, f: [87, 82, 66, 89, 55, 86],
    tags: ['legend', 'champions', 'serie_a', 'world_cup'],
  },
  {
    n: 'Gianluca Pagliuca', nat: 'ITA', pos: 'GK', prime: '1991-1994', club: 'Sampdoria', era: '90s',
    foot: 'R', h: 190, style: 'shot_stopper', ovr: 86, f: [87, 82, 68, 89, 62, 84],
    tags: ['legend', 'serie_a', 'italia'],
  },
  {
    n: 'José Luis Chilavert', nat: 'PAR', pos: 'GK', prime: '1996-1999', club: 'Vélez Sarsfield', era: '90s',
    foot: 'L', h: 188, style: 'shot_stopper', ovr: 84, f: [83, 84, 86, 85, 55, 85],
    x: { fk: 84, pen: 88, lon: 72, com: 85 },
    tags: ['legend', 'cult'],
  },
  {
    n: 'Sebastiano Rossi', nat: 'ITA', pos: 'GK', prime: '1993-1996', club: 'Milan', era: '90s',
    foot: 'R', h: 197, style: 'shot_stopper', ovr: 81, f: [79, 80, 64, 82, 52, 83],
    tags: ['legend', 'champions', 'serie_a', 'cult'],
  },
  {
    n: 'René Higuita', nat: 'COL', pos: 'GK', prime: '1988-1990', club: 'Atlético Nacional', era: '80s',
    foot: 'R', h: 175, style: 'sweeper_keeper', ovr: 80, f: [80, 74, 86, 84, 78, 78],
    x: { fk: 75, pen: 82 },
    tags: ['legend', 'cult'],
  },
  {
    n: 'Luca Marchegiani', nat: 'ITA', pos: 'GK', prime: '1995-1998', club: 'Lazio', era: '90s',
    foot: 'R', h: 187, style: 'shot_stopper', ovr: 79, f: [79, 78, 64, 80, 55, 79],
    tags: ['legend', 'serie_a', 'italia'],
  },
  {
    n: 'Christian Abbiati', nat: 'ITA', pos: 'GK', prime: '2010-2012', club: 'Milan', era: '2010s',
    foot: 'R', h: 191, style: 'shot_stopper', ovr: 78, f: [78, 77, 64, 80, 55, 77],
    tags: ['legend', 'serie_a', 'italia'],
  },
  {
    n: 'Sepp Maier', nat: 'GER', pos: 'GK', prime: '1972-1976', club: 'Bayern München', era: '70s',
    foot: 'R', h: 183, style: 'shot_stopper', ovr: 89, f: [88, 87, 66, 91, 62, 90],
    tags: ['legend', 'world_cup', 'champions', 'bundesliga'],
  },
  {
    n: 'Jens Lehmann', nat: 'GER', pos: 'GK', prime: '2003-2006', club: 'Arsenal', era: '2000s',
    foot: 'R', h: 190, style: 'sweeper_keeper', ovr: 86, f: [85, 84, 78, 87, 64, 86],
    x: { agg: 70 },
    tags: ['legend', 'premier', 'cult'],
  },
  {
    n: 'Francesco Toldo', nat: 'ITA', pos: 'GK', prime: '1999-2003', club: 'Fiorentina', era: '2000s',
    foot: 'R', h: 196, style: 'shot_stopper', ovr: 86, f: [86, 84, 66, 89, 52, 86],
    tags: ['legend', 'serie_a', 'italia'],
  },
  {
    n: 'Michel Preud\'homme', nat: 'BEL', pos: 'GK', prime: '1993-1995', club: 'Benfica', era: '90s',
    foot: 'R', h: 182, style: 'shot_stopper', ovr: 86, f: [87, 83, 66, 89, 62, 86],
    tags: ['legend', 'world_cup'],
  },
  {
    n: 'Víctor Valdés', nat: 'ESP', pos: 'GK', prime: '2009-2011', club: 'Barcelona', era: '2000s',
    foot: 'R', h: 183, style: 'sweeper_keeper', ovr: 85, f: [84, 81, 82, 87, 66, 84],
    tags: ['legend', 'champions', 'laliga'],
  },
  {
    n: 'Stefano Tacconi', nat: 'ITA', pos: 'GK', prime: '1985-1989', club: 'Juventus', era: '80s',
    foot: 'R', h: 184, style: 'shot_stopper', ovr: 81, f: [80, 80, 64, 83, 56, 81],
    tags: ['legend', 'champions', 'serie_a', 'italia'],
  },
  {
    n: 'Cláudio Taffarel', nat: 'BRA', pos: 'GK', prime: '1993-1995', club: 'Reggiana', era: '90s',
    foot: 'R', h: 182, style: 'shot_stopper', ovr: 81, f: [81, 78, 66, 84, 58, 80],
    tags: ['legend', 'world_cup', 'serie_a'],
  },
  {
    n: 'Federico Marchetti', nat: 'ITA', pos: 'GK', prime: '2008-2010', club: 'Cagliari', era: '2000s',
    foot: 'R', h: 188, style: 'shot_stopper', ovr: 78, f: [78, 76, 64, 80, 54, 77],
    tags: ['legend', 'serie_a', 'italia'],
  },
  {
    n: 'Morgan De Sanctis', nat: 'ITA', pos: 'GK', prime: '2010-2012', club: 'Napoli', era: '2010s',
    foot: 'R', h: 190, style: 'shot_stopper', ovr: 77, f: [76, 77, 64, 78, 52, 78],
    tags: ['legend', 'serie_a', 'italia'],
  },

  // ───────────────────────────── Modern ─────────────────────────────
  {
    n: 'Manuel Neuer', nat: 'GER', pos: 'GK', prime: '2013-2016', club: 'Bayern München', era: '2010s',
    foot: 'R', h: 193, style: 'sweeper_keeper', ovr: 93, f: [91, 89, 90, 92, 72, 94],
    tags: ['modern', 'world_cup', 'champions', 'bundesliga'],
  },
  {
    n: 'Thibaut Courtois', nat: 'BEL', pos: 'GK', prime: '2021-2023', club: 'Real Madrid', era: '2020s',
    foot: 'L', h: 199, style: 'shot_stopper', ovr: 90, f: [88, 88, 72, 91, 52, 90],
    tags: ['modern', 'champions', 'laliga'],
  },
  {
    n: 'Alisson Becker', nat: 'BRA', pos: 'GK', prime: '2018-2020', club: 'Liverpool', era: '2010s',
    foot: 'R', h: 193, style: 'sweeper_keeper', ovr: 90, f: [88, 88, 86, 89, 66, 91],
    tags: ['modern', 'champions', 'premier'],
  },
  {
    n: 'Jan Oblak', nat: 'SVN', pos: 'GK', prime: '2016-2019', club: 'Atlético Madrid', era: '2010s',
    foot: 'R', h: 188, style: 'shot_stopper', ovr: 90, f: [88, 88, 68, 91, 58, 92],
    tags: ['modern', 'laliga'],
  },
  {
    n: 'David De Gea', nat: 'ESP', pos: 'GK', prime: '2017-2018', club: 'Manchester United', era: '2010s',
    foot: 'R', h: 192, style: 'shot_stopper', ovr: 89, f: [91, 82, 68, 93, 62, 86],
    tags: ['modern', 'premier'],
  },
  {
    n: 'Marc-André ter Stegen', nat: 'GER', pos: 'GK', prime: '2017-2020', club: 'Barcelona', era: '2010s',
    foot: 'R', h: 187, style: 'sweeper_keeper', ovr: 89, f: [87, 85, 91, 90, 64, 87],
    tags: ['modern', 'champions', 'laliga'],
  },
  {
    n: 'Gianluigi Donnarumma', nat: 'ITA', pos: 'GK', prime: '2021-2025', club: 'Paris Saint-Germain', era: '2020s',
    foot: 'R', h: 196, style: 'shot_stopper', ovr: 89, f: [89, 82, 70, 93, 58, 86],
    tags: ['modern', 'champions', 'italia'],
  },
  {
    n: 'Ederson', nat: 'BRA', pos: 'GK', prime: '2021-2023', club: 'Manchester City', era: '2020s',
    foot: 'L', h: 188, style: 'sweeper_keeper', ovr: 88, f: [86, 84, 93, 87, 68, 86],
    tags: ['modern', 'champions', 'premier'],
  },
  {
    n: 'Hugo Lloris', nat: 'FRA', pos: 'GK', prime: '2017-2019', club: 'Tottenham', era: '2010s',
    foot: 'L', h: 188, style: 'shot_stopper', ovr: 87, f: [88, 82, 68, 90, 70, 84],
    tags: ['modern', 'world_cup', 'premier'],
  },
  {
    n: 'Mike Maignan', nat: 'FRA', pos: 'GK', prime: '2021-2023', club: 'Milan', era: '2020s',
    foot: 'R', h: 191, style: 'shot_stopper', ovr: 87, f: [86, 84, 85, 88, 63, 86],
    tags: ['modern', 'serie_a'],
  },
  {
    n: 'Emiliano Martínez', nat: 'ARG', pos: 'GK', prime: '2021-2023', club: 'Aston Villa', era: '2020s',
    foot: 'R', h: 195, style: 'shot_stopper', ovr: 86, f: [85, 83, 74, 87, 56, 86],
    x: { com: 88, agg: 75 },
    tags: ['modern', 'world_cup', 'premier', 'cult'],
  },
  {
    n: 'Rui Patrício', nat: 'POR', pos: 'GK', prime: '2015-2017', club: 'Sporting CP', era: '2010s',
    foot: 'R', h: 190, style: 'shot_stopper', ovr: 81, f: [82, 78, 68, 84, 55, 80],
    tags: ['modern'],
  },
  {
    n: 'Salvatore Sirigu', nat: 'ITA', pos: 'GK', prime: '2012-2015', club: 'Paris Saint-Germain', era: '2010s',
    foot: 'R', h: 192, style: 'shot_stopper', ovr: 80, f: [80, 78, 68, 82, 55, 80],
    tags: ['modern', 'italia'],
  },
  {
    n: 'Jordan Pickford', nat: 'ENG', pos: 'GK', prime: '2018-2022', club: 'Everton', era: '2010s',
    foot: 'L', h: 185, style: 'shot_stopper', ovr: 79, f: [80, 74, 84, 81, 60, 77],
    tags: ['modern', 'premier', 'cult'],
  },
  {
    n: 'Andrea Consigli', nat: 'ITA', pos: 'GK', prime: '2015-2018', club: 'Sassuolo', era: '2010s',
    foot: 'R', h: 189, style: 'shot_stopper', ovr: 77, f: [77, 76, 66, 79, 52, 77],
    tags: ['modern', 'serie_a', 'italia'],
  },
  {
    n: 'Keylor Navas', nat: 'CRC', pos: 'GK', prime: '2016-2018', club: 'Real Madrid', era: '2010s',
    foot: 'R', h: 185, style: 'shot_stopper', ovr: 87, f: [89, 82, 70, 91, 62, 85],
    tags: ['modern', 'champions', 'laliga', 'cult'],
  },
  {
    n: 'Samir Handanović', nat: 'SVN', pos: 'GK', prime: '2013-2017', club: 'Inter', era: '2010s',
    foot: 'R', h: 193, style: 'shot_stopper', ovr: 86, f: [86, 84, 66, 88, 54, 87],
    x: { pen: 30 },
    tags: ['modern', 'serie_a'],
  },
  {
    n: 'Wojciech Szczęsny', nat: 'POL', pos: 'GK', prime: '2018-2020', club: 'Juventus', era: '2010s',
    foot: 'R', h: 195, style: 'shot_stopper', ovr: 82, f: [82, 80, 70, 84, 55, 82],
    tags: ['modern', 'serie_a', 'cult'],
  },
  {
    n: 'Guglielmo Vicario', nat: 'ITA', pos: 'GK', prime: '2023-2025', club: 'Tottenham', era: '2020s',
    foot: 'R', h: 194, style: 'shot_stopper', ovr: 80, f: [81, 76, 68, 84, 56, 78],
    tags: ['modern', 'premier', 'italia'],
  },
  {
    n: 'Alex Meret', nat: 'ITA', pos: 'GK', prime: '2022-2024', club: 'Napoli', era: '2020s',
    foot: 'L', h: 190, style: 'shot_stopper', ovr: 78, f: [78, 76, 66, 81, 54, 77],
    tags: ['modern', 'serie_a', 'italia'],
  },
  {
    n: 'Ivan Provedel', nat: 'ITA', pos: 'GK', prime: '2022-2024', club: 'Lazio', era: '2020s',
    foot: 'R', h: 190, style: 'sweeper_keeper', ovr: 77, f: [76, 75, 76, 78, 58, 77],
    tags: ['modern', 'serie_a', 'italia'],
  },

  // ───────────────────────────── Bidoni ─────────────────────────────
  {
    n: 'Massimo Taibi', nat: 'ITA', pos: 'GK', prime: '1999-2000', club: 'Manchester United', era: '90s',
    foot: 'R', h: 190, style: 'shot_stopper', ovr: 64, f: [65, 55, 58, 66, 48, 60],
    tags: ['legend', 'premier', 'bidoni', 'cult'],
  },
  {
    n: 'Roy Carroll', nat: 'NIR', pos: 'GK', prime: '2004-2005', club: 'Manchester United', era: '2000s',
    foot: 'R', h: 188, style: 'shot_stopper', ovr: 65, f: [66, 58, 60, 67, 48, 62],
    tags: ['legend', 'premier', 'bidoni'],
  },
  {
    n: 'Heurelho Gomes', nat: 'BRA', pos: 'GK', prime: '2008-2009', club: 'Tottenham', era: '2000s',
    foot: 'R', h: 191, style: 'shot_stopper', ovr: 67, f: [70, 56, 60, 72, 52, 60],
    tags: ['legend', 'premier', 'bidoni', 'cult'],
  },
  {
    n: 'Robert Green', nat: 'ENG', pos: 'GK', prime: '2009-2010', club: 'West Ham', era: '2000s',
    foot: 'R', h: 190, style: 'shot_stopper', ovr: 66, f: [66, 57, 64, 68, 50, 64],
    tags: ['legend', 'premier', 'bidoni', 'cult'],
  },
  {
    n: 'Scott Carson', nat: 'ENG', pos: 'GK', prime: '2007-2008', club: 'Aston Villa', era: '2000s',
    foot: 'R', h: 190, style: 'shot_stopper', ovr: 63, f: [63, 58, 62, 65, 48, 62],
    tags: ['legend', 'premier', 'bidoni'],
  },
  {
    n: 'Loris Karius', nat: 'GER', pos: 'GK', prime: '2017-2018', club: 'Liverpool', era: '2010s',
    foot: 'R', h: 189, style: 'shot_stopper', ovr: 62, f: [66, 52, 64, 66, 54, 58],
    x: { com: 40 },
    tags: ['modern', 'premier', 'champions', 'bidoni', 'cult'],
  },
  {
    n: 'Carlo Pinsoglio', nat: 'ITA', pos: 'GK', prime: '2020-2023', club: 'Juventus', era: '2020s',
    foot: 'L', h: 194, style: 'shot_stopper', ovr: 58, f: [58, 57, 56, 60, 45, 57],
    tags: ['modern', 'serie_a', 'bidoni', 'cult'],
  },
];
