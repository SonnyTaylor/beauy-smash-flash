use std::collections::{BinaryHeap, HashMap};

use crate::game::{circle_hits_walls, Rect, PLAYER_RADIUS};

#[derive(Clone, Debug)]
pub struct NavGrid {
    pub cell_size: f32,
    pub cols: usize,
    pub rows: usize,
    pub blocked: Vec<bool>,
}

impl NavGrid {
    pub fn new(world_width: f32, world_height: f32, walls: &[Rect]) -> Self {
        let cell_size = 48.0f32;
        let cols = (world_width / cell_size).ceil().max(1.0) as usize;
        let rows = (world_height / cell_size).ceil().max(1.0) as usize;
        let mut blocked = vec![false; cols * rows];

        for y in 0..rows {
            for x in 0..cols {
                let px = x as f32 * cell_size + cell_size * 0.5;
                let py = y as f32 * cell_size + cell_size * 0.5;
                if circle_hits_walls(px, py, PLAYER_RADIUS, walls) {
                    blocked[y * cols + x] = true;
                }
            }
        }

        Self {
            cell_size,
            cols,
            rows,
            blocked,
        }
    }

    pub fn world_to_cell(&self, x: f32, y: f32) -> (usize, usize) {
        let cx = ((x / self.cell_size).floor() as isize).clamp(0, self.cols as isize - 1) as usize;
        let cy = ((y / self.cell_size).floor() as isize).clamp(0, self.rows as isize - 1) as usize;
        (cx, cy)
    }

    pub fn cell_center(&self, cx: usize, cy: usize) -> (f32, f32) {
        (
            cx as f32 * self.cell_size + self.cell_size * 0.5,
            cy as f32 * self.cell_size + self.cell_size * 0.5,
        )
    }

    pub fn is_walkable(&self, cx: usize, cy: usize) -> bool {
        cx < self.cols && cy < self.rows && !self.blocked[cy * self.cols + cx]
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Node {
    x: usize,
    y: usize,
    g: f32,
    f: f32,
}

impl Eq for Node {}

impl Ord for Node {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        other
            .f
            .partial_cmp(&self.f)
            .unwrap_or(std::cmp::Ordering::Equal)
    }
}

impl PartialOrd for Node {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

pub fn find_path(
    grid: &NavGrid,
    from_x: f32,
    from_y: f32,
    to_x: f32,
    to_y: f32,
) -> Option<Vec<(f32, f32)>> {
    let (mut sx, mut sy) = grid.world_to_cell(from_x, from_y);
    let (mut tx, mut ty) = grid.world_to_cell(to_x, to_y);

    if !grid.is_walkable(sx, sy) {
        let mut best = None;
        let mut best_dist = f32::MAX;
        for dy in -2..=2 {
            for dx in -2..=2 {
                let nx = sx as isize + dx;
                let ny = sy as isize + dy;
                if nx < 0 || ny < 0 || nx >= grid.cols as isize || ny >= grid.rows as isize {
                    continue;
                }
                let nx = nx as usize;
                let ny = ny as usize;
                if grid.is_walkable(nx, ny) {
                    let (wx, wy) = grid.cell_center(nx, ny);
                    let dist = (wx - from_x).powi(2) + (wy - from_y).powi(2);
                    if dist < best_dist {
                        best_dist = dist;
                        best = Some((nx, ny));
                    }
                }
            }
        }
        (sx, sy) = best?;
    }

    if !grid.is_walkable(tx, ty) {
        let mut best = None;
        let mut best_dist = f32::MAX;
        for dy in -2..=2 {
            for dx in -2..=2 {
                let nx = tx as isize + dx;
                let ny = ty as isize + dy;
                if nx < 0 || ny < 0 || nx >= grid.cols as isize || ny >= grid.rows as isize {
                    continue;
                }
                let nx = nx as usize;
                let ny = ny as usize;
                if grid.is_walkable(nx, ny) {
                    let (wx, wy) = grid.cell_center(nx, ny);
                    let dist = (wx - to_x).powi(2) + (wy - to_y).powi(2);
                    if dist < best_dist {
                        best_dist = dist;
                        best = Some((nx, ny));
                    }
                }
            }
        }
        (tx, ty) = best?;
    }

    let mut open = BinaryHeap::new();
    let mut came_from: HashMap<(usize, usize), (usize, usize)> = HashMap::new();
    let mut g_score: HashMap<(usize, usize), f32> = HashMap::new();

    g_score.insert((sx, sy), 0.0);
    open.push(Node {
        x: sx,
        y: sy,
        g: 0.0,
        f: heuristic(sx, sy, tx, ty, grid.cell_size),
    });

    let neighbors = [
        (0, 1),
        (0, -1),
        (1, 0),
        (-1, 0),
        (1, 1),
        (1, -1),
        (-1, 1),
        (-1, -1),
    ];

    while let Some(current) = open.pop() {
        if current.x == tx && current.y == ty {
            let mut path = vec![];
            let mut curr = (tx, ty);
            while let Some(&prev) = came_from.get(&curr) {
                let (wx, wy) = grid.cell_center(curr.0, curr.1);
                path.push((wx, wy));
                curr = prev;
            }
            path.reverse();
            return Some(path);
        }

        if current.g > *g_score.get(&(current.x, current.y)).unwrap_or(&f32::MAX) {
            continue;
        }

        for (dx, dy) in neighbors {
            let nx = current.x as isize + dx;
            let ny = current.y as isize + dy;
            if nx < 0 || ny < 0 || nx >= grid.cols as isize || ny >= grid.rows as isize {
                continue;
            }
            let nx = nx as usize;
            let ny = ny as usize;
            if !grid.is_walkable(nx, ny) {
                continue;
            }
            if dx != 0 && dy != 0 {
                if !grid.is_walkable(current.x, ny) || !grid.is_walkable(nx, current.y) {
                    continue;
                }
            }

            let move_cost = if dx != 0 && dy != 0 { 1.4142 } else { 1.0 };
            let tentative_g = current.g + move_cost * grid.cell_size;

            if tentative_g < *g_score.get(&(nx, ny)).unwrap_or(&f32::MAX) {
                came_from.insert((nx, ny), (current.x, current.y));
                g_score.insert((nx, ny), tentative_g);
                let f = tentative_g + heuristic(nx, ny, tx, ty, grid.cell_size);
                open.push(Node {
                    x: nx,
                    y: ny,
                    g: tentative_g,
                    f,
                });
            }
        }
    }

    None
}

fn heuristic(x1: usize, y1: usize, x2: usize, y2: usize, cell_size: f32) -> f32 {
    let dx = (x1 as f32 - x2 as f32).abs();
    let dy = (y1 as f32 - y2 as f32).abs();
    (dx + dy).min(dx.max(dy) * 1.414) * cell_size
}
