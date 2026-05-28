use serde::Deserialize;

use crate::game::{GameMap, Rect};

#[path = "maps_embedded.rs"]
mod maps_embedded;

pub const DEFAULT_MAP_ID: &str = "split";
pub const LOGICAL_WIDTH: f32 = 1280.0;
pub const LOGICAL_HEIGHT: f32 = 720.0;
pub const CELL_SIZE: f32 = 40.0;
pub const GRID_COLS: usize = 32;
pub const GRID_ROWS: usize = 18;

#[derive(Debug, Deserialize, Default)]
struct MapThemeDef {
    #[serde(default = "default_floor")]
    floor: String,
    #[serde(default = "default_grid")]
    grid: String,
    #[serde(default = "default_walls")]
    walls: String,
    #[serde(default = "default_wall_stroke")]
    wall_stroke: String,
    #[serde(default = "default_accent")]
    accent: String,
}

fn default_floor() -> String {
    "#0a0c16".to_string()
}
fn default_grid() -> String {
    "#1a2038".to_string()
}
fn default_walls() -> String {
    "#1c1f32".to_string()
}
fn default_wall_stroke() -> String {
    "#4a5278".to_string()
}
fn default_accent() -> String {
    "#46e9ff".to_string()
}

#[derive(Debug, Deserialize)]
struct MapGridDef {
    cols: usize,
    rows: usize,
    cell: f32,
    solid: Vec<String>,
    spawn: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct MapWallDef {
    id: Option<String>,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
}

#[derive(Debug, Deserialize)]
struct MapDefinition {
    id: String,
    name: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    theme: MapThemeDef,
    grid: Option<MapGridDef>,
    walls: Option<Vec<MapWallDef>>,
    spawns: Option<Vec<[f32; 2]>>,
}

#[derive(Clone, Debug)]
pub struct CompiledMap {
    pub id: String,
    pub name: String,
    pub walls: Vec<Rect>,
    pub spawns: Vec<(f32, f32)>,
}

fn compile_grid(grid: &MapGridDef) -> Result<(Vec<Rect>, Vec<(f32, f32)>), String> {
    if grid.cols != GRID_COLS || grid.rows != GRID_ROWS {
        return Err(format!(
            "Grid must be {GRID_COLS}x{GRID_ROWS}, got {}x{}",
            grid.cols, grid.rows
        ));
    }
    if (grid.cell - CELL_SIZE).abs() > 0.001 {
        return Err(format!(
            "Grid cell size must be {CELL_SIZE}, got {}",
            grid.cell
        ));
    }
    if grid.solid.len() != GRID_ROWS || grid.spawn.len() != GRID_ROWS {
        return Err("Grid layers must have 18 rows".to_string());
    }

    let mut cells: Vec<Vec<bool>> = grid
        .solid
        .iter()
        .map(|row| {
            if row.chars().count() != GRID_COLS {
                return Err(format!("Solid row width must be {GRID_COLS}"));
            }
            Ok(row
                .chars()
                .map(|ch| ch == '#' || ch == '█')
                .collect::<Vec<_>>())
        })
        .collect::<Result<_, _>>()?;

    let walls = merge_wall_rects(&mut cells, grid.cell);
    let mut spawns = Vec::new();

    for (row_index, row) in grid.spawn.iter().enumerate() {
        if row.chars().count() != GRID_COLS {
            return Err(format!("Spawn row width must be {GRID_COLS}"));
        }
        for (col_index, ch) in row.chars().enumerate() {
            if ('1'..='9').contains(&ch) {
                spawns.push((
                    col_index as f32 * grid.cell + grid.cell / 2.0,
                    row_index as f32 * grid.cell + grid.cell / 2.0,
                ));
            }
        }
    }

    spawns.sort_by(|left, right| {
        left.0
            .partial_cmp(&right.0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                left.1
                    .partial_cmp(&right.1)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    Ok((walls, spawns))
}

fn merge_wall_rects(cells: &mut [Vec<bool>], cell: f32) -> Vec<Rect> {
    let mut rects = Vec::new();
    let rows = cells.len();

    for row in 0..rows {
        let cols = cells[row].len();
        let mut col = 0;
        while col < cols {
            if !cells[row][col] {
                col += 1;
                continue;
            }

            let mut width = 1usize;
            while col + width < cols && cells[row][col + width] {
                width += 1;
            }

            let mut height = 1usize;
            let mut can_grow = true;
            while can_grow && row + height < rows {
                for probe in 0..width {
                    if !cells[row + height][col + probe] {
                        can_grow = false;
                        break;
                    }
                }
                if can_grow {
                    height += 1;
                }
            }

            for y in row..row + height {
                for x in col..col + width {
                    cells[y][x] = false;
                }
            }

            rects.push(Rect {
                x: col as f32 * cell,
                y: row as f32 * cell,
                w: width as f32 * cell,
                h: height as f32 * cell,
            });

            col += width;
        }
    }

    rects
}

fn compile_definition(definition: &MapDefinition) -> Result<CompiledMap, String> {
    let (walls, spawns) = if let Some(grid) = &definition.grid {
        compile_grid(grid)?
    } else {
        let walls = definition
            .walls
            .as_ref()
            .ok_or_else(|| format!("Map \"{}\" has no walls or grid", definition.id))?
            .iter()
            .map(|wall| Rect {
                x: wall.x,
                y: wall.y,
                w: wall.w,
                h: wall.h,
            })
            .collect::<Vec<_>>();
        let spawns = definition
            .spawns
            .as_ref()
            .ok_or_else(|| format!("Map \"{}\" has no spawns or grid", definition.id))?
            .iter()
            .map(|spawn| (spawn[0], spawn[1]))
            .collect::<Vec<_>>();
        (walls, spawns)
    };

    if walls.is_empty() {
        return Err(format!("Map \"{}\" has no walls", definition.id));
    }
    if spawns.is_empty() {
        return Err(format!("Map \"{}\" has no spawns", definition.id));
    }

    Ok(CompiledMap {
        id: definition.id.clone(),
        name: definition.name.clone(),
        walls,
        spawns,
    })
}

fn scale_compiled(map: CompiledMap, width: f32, height: f32) -> CompiledMap {
    let sx = width / LOGICAL_WIDTH;
    let sy = height / LOGICAL_HEIGHT;

    CompiledMap {
        walls: map
            .walls
            .into_iter()
            .map(|wall| Rect {
                x: wall.x * sx,
                y: wall.y * sy,
                w: wall.w * sx,
                h: wall.h * sy,
            })
            .collect(),
        spawns: map
            .spawns
            .into_iter()
            .map(|(x, y)| (x * sx, y * sy))
            .collect(),
        ..map
    }
}

pub fn load_map(map_id: &str, width: f32, height: f32) -> GameMap {
    let compiled = compile_map_by_id(map_id).unwrap_or_else(|error| {
        eprintln!("Failed to load map \"{map_id}\": {error}. Falling back to {DEFAULT_MAP_ID}.");
        compile_map_by_id(DEFAULT_MAP_ID).expect("default map must load")
    });

    let scaled = scale_compiled(compiled, width, height);
    GameMap {
        id: scaled.id,
        name: scaled.name,
        walls: scaled.walls,
        spawns: scaled.spawns,
    }
}

pub fn list_map_ids() -> Vec<&'static str> {
    maps_embedded::MAP_BLOBS.iter().map(|(id, _)| *id).collect()
}

fn compile_map_by_id(map_id: &str) -> Result<CompiledMap, String> {
    let json = maps_embedded::MAP_BLOBS
        .iter()
        .find(|(id, _)| *id == map_id)
        .map(|(_, json)| *json)
        .ok_or_else(|| format!("Unknown map id \"{map_id}\""))?;

    let definition: MapDefinition =
        serde_json::from_str(json).map_err(|error| format!("Invalid map JSON: {error}"))?;
    compile_definition(&definition)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_embedded_maps_compile() {
        for (id, _) in maps_embedded::MAP_BLOBS {
            let map = compile_map_by_id(id).expect("map should compile");
            assert!(!map.walls.is_empty());
            assert!(map.spawns.len() >= 2);
        }
    }

    #[test]
    fn default_map_loads_at_runtime_resolution() {
        let map = load_map(DEFAULT_MAP_ID, crate::game::DEFAULT_WORLD_WIDTH, crate::game::DEFAULT_WORLD_HEIGHT);
        assert_eq!(map.id, DEFAULT_MAP_ID);
        assert!(map.spawns[0].0 > 0.0);
    }
}
