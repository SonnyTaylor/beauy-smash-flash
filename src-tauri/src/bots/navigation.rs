use crate::game::{circle_hits_walls, normalize, BotNavState, GameWorld, PLAYER_RADIUS};

const STEP_PROBE: f32 = 34.0;
const STUCK_MOVE_EPS: f32 = 1.25;
const STUCK_TIME_THRESHOLD: f32 = 0.4;
const RECOVERY_TIME: f32 = 0.8;

pub fn has_clear_path(world: &GameWorld, x1: f32, y1: f32, x2: f32, y2: f32) -> bool {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let dist = (dx * dx + dy * dy).sqrt();
    if dist <= 0.001 {
        return true;
    }
    let steps = (dist / 20.0).ceil().max(1.0) as i32;
    for step in 0..=steps {
        let t = step as f32 / steps as f32;
        let px = x1 + dx * t;
        let py = y1 + dy * t;
        if circle_hits_walls(px, py, PLAYER_RADIUS, &world.map.walls) {
            return false;
        }
    }
    true
}

pub fn navigate_toward(
    world: &mut GameWorld,
    id: u8,
    x: f32,
    y: f32,
    target_x: f32,
    target_y: f32,
    dt: f32,
) -> (f32, f32) {
    let mut nav = world.bot_nav.get(&id).copied().unwrap_or(BotNavState {
        last_x: x,
        last_y: y,
        ..BotNavState::default()
    });

    let moved = ((x - nav.last_x).powi(2) + (y - nav.last_y).powi(2)).sqrt();
    nav.last_x = x;
    nav.last_y = y;

    let direction = if nav.recover_secs > 0.0 {
        nav.recover_secs = (nav.recover_secs - dt).max(0.0);
        if nav.recover_secs > 0.0
            && direction_clear(world, x, y, nav.recover_dx, nav.recover_dy)
        {
            (nav.recover_dx, nav.recover_dy)
        } else {
            nav.recover_secs = 0.0;
            pick_best_direction(world, x, y, target_x, target_y)
        }
    } else {
        let desired = pick_best_direction(world, x, y, target_x, target_y);
        let wants_move = desired.0.abs() > 0.001 || desired.1.abs() > 0.001;

        if wants_move && moved < STUCK_MOVE_EPS {
            nav.stuck_secs += dt;
        } else if wants_move {
            nav.stuck_secs = 0.0;
        }

        if nav.stuck_secs >= STUCK_TIME_THRESHOLD {
            let (rx, ry) = pick_recovery_direction(world, x, y, target_x, target_y);
            nav.recover_dx = rx;
            nav.recover_dy = ry;
            nav.recover_secs = RECOVERY_TIME;
            nav.stuck_secs = 0.0;
            (rx, ry)
        } else {
            desired
        }
    };

    world.bot_nav.insert(id, nav);
    direction
}

fn pick_best_direction(
    world: &GameWorld,
    x: f32,
    y: f32,
    target_x: f32,
    target_y: f32,
) -> (f32, f32) {
    let to_x = target_x - x;
    let to_y = target_y - y;
    if to_x.abs() < 1.0 && to_y.abs() < 1.0 {
        return (0.0, 0.0);
    }

    if let Some(slide) = pick_axis_slide(world, x, y, target_x, target_y) {
        return slide;
    }

    let (dir_x, dir_y) = normalize(to_x, to_y);
    if direction_clear(world, x, y, dir_x, dir_y) {
        return (dir_x, dir_y);
    }

    let mut best = (0.0f32, 0.0f32, -1.0f32);
    for i in 0..16 {
        let angle = (i as f32 / 16.0) * std::f32::consts::TAU;
        let probe_x = angle.cos();
        let probe_y = angle.sin();
        if !direction_clear(world, x, y, probe_x, probe_y) {
            continue;
        }
        let toward = probe_x * dir_x + probe_y * dir_y;
        if toward > best.2 {
            best = (probe_x, probe_y, toward);
        }
    }

    if best.2 > 0.0 {
        return (best.0, best.1);
    }

    for i in 0..8 {
        let angle = (i as f32 / 8.0) * std::f32::consts::TAU;
        let probe_x = angle.cos();
        let probe_y = angle.sin();
        if direction_clear(world, x, y, probe_x, probe_y) {
            return (probe_x, probe_y);
        }
    }

    (0.0, 0.0)
}

fn pick_axis_slide(
    world: &GameWorld,
    x: f32,
    y: f32,
    target_x: f32,
    target_y: f32,
) -> Option<(f32, f32)> {
    let dx = target_x - x;
    let dy = target_y - y;
    let x_step = if dx.abs() > 1.0 { dx.signum() } else { 0.0 };
    let y_step = if dy.abs() > 1.0 { dy.signum() } else { 0.0 };

    let x_clear = x_step != 0.0 && axis_clear(world, x, y, x_step, 0.0);
    let y_clear = y_step != 0.0 && axis_clear(world, x, y, 0.0, y_step);

    match (x_clear, y_clear) {
        (true, true) => {
            if dx.abs() >= dy.abs() {
                Some((x_step, 0.0))
            } else {
                Some((0.0, y_step))
            }
        }
        (true, false) => Some((x_step, 0.0)),
        (false, true) => Some((0.0, y_step)),
        (false, false) => None,
    }
}

fn pick_recovery_direction(
    world: &GameWorld,
    x: f32,
    y: f32,
    target_x: f32,
    target_y: f32,
) -> (f32, f32) {
    let cardinals = [(1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0)];
    let mut best = (0.0f32, 0.0f32, f32::MAX);

    for (dx, dy) in cardinals {
        if !direction_clear(world, x, y, dx, dy) {
            continue;
        }
        let nx = x + dx * STEP_PROBE;
        let ny = y + dy * STEP_PROBE;
        let dist = (target_x - nx).powi(2) + (target_y - ny).powi(2);
        if dist < best.2 {
            best = (dx, dy, dist);
        }
    }

    if best.2 < f32::MAX {
        return (best.0, best.1);
    }

    for i in 0..8 {
        let angle = (i as f32 / 8.0) * std::f32::consts::TAU;
        let dx = angle.cos();
        let dy = angle.sin();
        if direction_clear(world, x, y, dx, dy) {
            return (dx, dy);
        }
    }

    (1.0, 0.0)
}

fn axis_clear(world: &GameWorld, x: f32, y: f32, move_x: f32, move_y: f32) -> bool {
    let nx = x + move_x * STEP_PROBE;
    let ny = y + move_y * STEP_PROBE;
    nx >= PLAYER_RADIUS
        && ny >= PLAYER_RADIUS
        && nx <= world.config.width - PLAYER_RADIUS
        && ny <= world.config.height - PLAYER_RADIUS
        && !circle_hits_walls(nx, ny, PLAYER_RADIUS, &world.map.walls)
}

fn direction_clear(world: &GameWorld, x: f32, y: f32, dir_x: f32, dir_y: f32) -> bool {
    if dir_x.abs() < 0.001 && dir_y.abs() < 0.001 {
        return false;
    }
    let (dir_x, dir_y) = normalize(dir_x, dir_y);
    let nx = x + dir_x * STEP_PROBE;
    let ny = y + dir_y * STEP_PROBE;
    nx >= PLAYER_RADIUS
        && ny >= PLAYER_RADIUS
        && nx <= world.config.width - PLAYER_RADIUS
        && ny <= world.config.height - PLAYER_RADIUS
        && !circle_hits_walls(nx, ny, PLAYER_RADIUS, &world.map.walls)
}
