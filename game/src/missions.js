// Missions: Lena's six jobs for the Del Toro syndicate. Each mission is a
// small state machine — go to a marker, do the thing, get to the next marker
// — with a payout at the end and the debt ticking down in the HUD.
import { distance } from './random.js';
import { randomPointInDistrict } from './city.js';

export const MISSION_ARRIVE = 70;

export function createMissionState(content) {
  return {
    index: 0,
    stage: 0,
    active: false,
    startedAt: 0,
    collected: 0,
    target: null,
    targets: [],
    message: '',
    messageTime: 0,
    done: [],
    allDone: false,
  };
}

export function currentMission(content, state) {
  return content.MISSIONS[state.index] || null;
}

/** Start the next mission: pick its markers from the city and brief the player. */
export function startMission(content, state, random, city, now) {
  const mission = currentMission(content, state);
  if (!mission) return null;
  state.active = true;
  state.stage = 0;
  state.collected = 0;
  state.startedAt = now;
  state.targets = mission.stops.map((stop) => randomPointInDistrict(random, city, content, stop.district));
  state.target = state.targets[0] || null;
  state.message = mission.brief;
  state.messageTime = 5;
  return mission;
}

/** Advance the mission when the player reaches the current marker. */
export function updateMission(content, state, player, now) {
  if (!state.active || !state.target) return null;
  const mission = currentMission(content, state);
  const d = distance(player.x, player.y, state.target.x, state.target.y);
  if (d < MISSION_ARRIVE) {
    state.collected += 1;
    state.stage += 1;
    if (state.stage >= state.targets.length) {
      return finishMission(content, state, player, now);
    }
    state.target = state.targets[state.stage];
    state.message = mission.stageText[state.stage] || 'Next stop marked.';
    state.messageTime = 4;
    return { event: 'stage', mission, stage: state.stage };
  }
  return null;
}

function finishMission(content, state, player, now) {
  const mission = currentMission(content, state);
  player.cash += mission.pay;
  state.done.push(mission.id);
  state.active = false;
  state.target = null;
  state.message = `${mission.title} complete — $${mission.pay.toLocaleString('en-US')} paid.`;
  state.messageTime = 6;
  const next = state.index + 1;
  if (next >= content.MISSIONS.length) {
    state.allDone = true;
    return { event: 'allDone', mission, pay: mission.pay };
  }
  state.index = next;
  return { event: 'complete', mission, pay: mission.pay };
}

/** Debt left after the missions done so far. */
export function debtLeft(content, state, totalDebt) {
  let earned = 0;
  for (const id of state.done) {
    const m = content.MISSIONS.find((x) => x.id === id);
    if (m) earned += m.pay;
  }
  return Math.max(0, totalDebt - earned);
}

export function totalPay(content) {
  return content.MISSIONS.reduce((sum, m) => sum + m.pay, 0);
}

export function missionProgress(content, state) {
  return { done: state.done.length, total: content.MISSIONS.length, allDone: state.allDone };
}

/** The mission list for the jobs screen (M), with done / current / locked marks. */
export function missionList(content, state) {
  return content.MISSIONS.map((m, i) => ({
    id: m.id,
    title: m.title,
    pay: m.pay,
    status: state.done.includes(m.id) ? 'done' : i === state.index ? 'current' : 'locked',
    brief: m.brief,
  }));
}
