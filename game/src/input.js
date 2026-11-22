// Keyboard input: a held-keys set plus edge-triggered actions, so a tap of
// E or F fires once even if the frame rate wobbles.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_ENTER_CAR = 'enterCar';
export const ACTION_PUNCH = 'punch';
export const ACTION_SHOOT = 'shoot';
export const ACTION_JOBS = 'jobs';
export const ACTION_RADIO = 'radio';
export const ACTION_NIGHT = 'night';
export const ACTION_MUTE = 'mute';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER_CAR,
  Space: ACTION_PUNCH,
  KeyF: ACTION_SHOOT,
  KeyM: ACTION_JOBS,
  KeyR: ACTION_RADIO,
  KeyN: ACTION_NIGHT,
  KeyX: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let pointer = { x: 0, y: 0, down: false };

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) pressed.add(action);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onBlur() {
    held.clear();
  }
  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top, down: pointer.down };
  }
  function onPointerDown(event) {
    onPointerMove(event);
    pointer.down = true;
  }
  function onPointerUp() {
    pointer.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  return {
    /** -1/0/1 drive axis from WASD + arrows (x: strafe/steer, y: forward). */
    axis() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    isDown(code) {
      return held.has(code);
    },
    /** True once, on the frame the action key went down. */
    wasPressed(action) {
      return pressed.has(action);
    },
    /** True while the pointer is held on the canvas. */
    pointer() {
      return pointer;
    },
    /** True when any movement key is held (used to wake the title screen). */
    anyMove() {
      return held.has('KeyW') || held.has('KeyA') || held.has('KeyS') || held.has('KeyD')
        || held.has('ArrowUp') || held.has('ArrowDown') || held.has('ArrowLeft') || held.has('ArrowRight');
    },
    /** Clear the edge-triggered set; call once per frame after the game reads it. */
    endFrame() {
      pressed.clear();
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };
}
