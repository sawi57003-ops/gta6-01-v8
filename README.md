# VERDE HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sawi57003-ops/gta6-01-v8/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sawi57003-ops/gta6-01-v8/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

## The story

Lena Cruz used to race powerboats off the Cayo Verde coast — until a fixed
race left her owing **$60,000 to the Del Toro syndicate**. One week. Six jobs.
The whole island city is hiring, if you can drive, run, and stay out of the
cells long enough to collect.

Cayo Verde is a fictional tropical island city: a street grid wrapped around a
marina, a neon downtown, the Calle Sol strip, Playa Verde beach, the working
docks, old town alleys and the soft middle of Midtown. Walk it, steal any car
on it, and watch the wanted stars climb when the Cayo Verde Police Department
decides you are the problem.

## Six jobs, $68,000

| Job | Pay |
| --- | --- |
| First Fare | $8,000 |
| Hot Wheels | $10,000 |
| Courier Run | $11,000 |
| Getaway | $12,000 |
| Payday | $13,000 |
| The Big One | $14,000 |

Finish all six and the $60,000 debt is gone, with $8,000 to spare.

## How to play

- **WASD / arrows** — walk, or drive when you are in a car
- **E** — get in / out of a car (steal any parked or traffic car)
- **Space** — punch
- **F** — shoot (pistol, watch your ammo)
- **M** — jobs list
- **P** — pause
- **R** — change radio station
- **N** — toggle day / night

The wanted level runs from one to five stars. Police cruisers chase and ram;
officers on foot will try to arrest you. Lose the heat by breaking line of
sight and staying out of trouble, or pay the price.

## Features

- Top-down open world: island street grid, beach, marina, neon downtown
- Drive and walk: steal any car, traffic and pedestrians react
- Five-star wanted level with chasing, ramming police cruisers
- Six story missions paying off a $60,000 debt
- Combat: punch + pistol, ammo pickups scattered through the city
- Day / night cycle and tropical rain
- HUD: cash, debt, health, ammo, wanted stars, district, current job, live minimap, radio
- Synthesised WebAudio sound — no audio files
- Start / pause / busted / wasted / complete screens; progress saves to localStorage
- Deterministic city: `?seed=N` rebuilds the same Cayo Verde; `?shot=` stages a screenshot scene

## Run it

```sh
# Build + validate (writes dossier.json and BUILD.txt to out/)
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

# Play it locally
node serve.ts

# then open http://localhost:8080
```

`main.ts` is the entrypoint: it owns the content catalogue (districts,
radio, cars, story beats, missions), generates `game/src/content.js` from
it, validates all sixteen game modules, and writes the dossier the judge
reads. The game itself is plain static files — `game/index.html` and its
ES modules, no library, no network request.

## License

MIT — see [LICENSE](LICENSE).
