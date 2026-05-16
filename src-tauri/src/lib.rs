use tauri::menu::{
    CheckMenuItem, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem,
    SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Manager, Wry};

/// Holds references to game-specific menu items so we can update their
/// checked state when the game state changes (e.g., the user changes
/// the Klondike draw mode via the Options dialog).
#[derive(Default)]
struct GameMenuState {
    draw_one: Option<CheckMenuItem<Wry>>,
    draw_three: Option<CheckMenuItem<Wry>>,
}

/// Capability-style spec describing what menu items a given variant supports.
struct GameSpec {
    has_auto_complete: bool,
    has_draw_modes: bool,
    about_label: &'static str,
}

fn spec_for(product_name: &str) -> GameSpec {
    match product_name {
        "Klondike" => GameSpec {
            has_auto_complete: true,
            has_draw_modes: true,
            about_label: "About Klondike",
        },
        "FreeCell" => GameSpec {
            has_auto_complete: true,
            has_draw_modes: false,
            about_label: "About FreeCell",
        },
        "Spider" => GameSpec {
            has_auto_complete: false,
            has_draw_modes: false,
            about_label: "About Spider",
        },
        "TriPeaks" => GameSpec {
            has_auto_complete: false,
            has_draw_modes: false,
            about_label: "About TriPeaks",
        },
        "Pyramid" => GameSpec {
            has_auto_complete: false,
            has_draw_modes: false,
            about_label: "About Pyramid",
        },
        _ => GameSpec {
            has_auto_complete: false,
            has_draw_modes: false,
            about_label: "About",
        },
    }
}

#[tauri::command]
fn sync_draw_mode(app: AppHandle, mode: u8) {
    if let Some(state) = app.try_state::<GameMenuState>() {
        if let Some(d1) = &state.draw_one {
            let _ = d1.set_checked(mode == 1);
        }
        if let Some(d3) = &state.draw_three {
            let _ = d3.set_checked(mode == 3);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sync_draw_mode])
        .setup(|app| {
            let handle = app.handle();
            let product_name = handle
                .config()
                .product_name
                .clone()
                .unwrap_or_else(|| "Klondike".to_string());
            let spec = spec_for(&product_name);

            // ---- Game menu (common) ----
            let new_game = MenuItemBuilder::with_id("new-game", "New Game")
                .accelerator("F2")
                .build(handle)?;
            let restart = MenuItemBuilder::with_id("restart", "Restart").build(handle)?;
            let stats = MenuItemBuilder::with_id("stats", "Statistics...").build(handle)?;
            let options = MenuItemBuilder::with_id("options", "Options...").build(handle)?;
            let quit = PredefinedMenuItem::quit(handle, Some("Exit"))?;

            let game_menu = SubmenuBuilder::new(handle, "&Game")
                .item(&new_game)
                .item(&restart)
                .separator()
                .item(&stats)
                .item(&options)
                .separator()
                .item(&quit)
                .build()?;

            // ---- Edit menu (auto-complete only when supported) ----
            let undo = MenuItemBuilder::with_id("undo", "Undo")
                .accelerator("CmdOrCtrl+Z")
                .build(handle)?;
            let hint = MenuItemBuilder::with_id("hint", "Hint")
                .accelerator("H")
                .build(handle)?;

            let mut edit_b = SubmenuBuilder::new(handle, "&Edit")
                .item(&undo)
                .separator()
                .item(&hint);

            let auto_complete = if spec.has_auto_complete {
                let item = MenuItemBuilder::with_id("auto-complete", "Auto-Complete")
                    .accelerator("CmdOrCtrl+A")
                    .build(handle)?;
                edit_b = edit_b.item(&item);
                Some(item)
            } else {
                None
            };
            let _ = auto_complete;
            let edit_menu = edit_b.build()?;

            // ---- View menu (draw modes only for Klondike) ----
            let fullscreen =
                PredefinedMenuItem::fullscreen(handle, Some("Toggle Full Screen"))?;

            let mut view_b = SubmenuBuilder::new(handle, "&View");
            let mut draw_one_holder: Option<CheckMenuItem<Wry>> = None;
            let mut draw_three_holder: Option<CheckMenuItem<Wry>> = None;
            if spec.has_draw_modes {
                let d1 = CheckMenuItemBuilder::with_id("draw-1", "Draw One")
                    .checked(true)
                    .build(handle)?;
                let d3 = CheckMenuItemBuilder::with_id("draw-3", "Draw Three")
                    .checked(false)
                    .build(handle)?;
                view_b = view_b.item(&d1).item(&d3).separator();
                draw_one_holder = Some(d1);
                draw_three_holder = Some(d3);
            }
            view_b = view_b.item(&fullscreen);
            let view_menu = view_b.build()?;

            // ---- Help menu ----
            let how_to_play =
                MenuItemBuilder::with_id("how-to-play", "How to Play").build(handle)?;
            let about = MenuItemBuilder::with_id("about", spec.about_label).build(handle)?;
            let help_menu = SubmenuBuilder::new(handle, "&Help")
                .item(&how_to_play)
                .separator()
                .item(&about)
                .build()?;

            let menu = MenuBuilder::new(handle)
                .item(&game_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            app.manage(GameMenuState {
                draw_one: draw_one_holder,
                draw_three: draw_three_holder,
            });

            app.on_menu_event(move |app, event| {
                let id = event.id().as_ref();
                match id {
                    "draw-1" => {
                        if let Some(s) = app.try_state::<GameMenuState>() {
                            if let Some(d) = &s.draw_one {
                                let _ = d.set_checked(true);
                            }
                            if let Some(d) = &s.draw_three {
                                let _ = d.set_checked(false);
                            }
                        }
                        let _ = app.emit("menu", "draw-1");
                    }
                    "draw-3" => {
                        if let Some(s) = app.try_state::<GameMenuState>() {
                            if let Some(d) = &s.draw_one {
                                let _ = d.set_checked(false);
                            }
                            if let Some(d) = &s.draw_three {
                                let _ = d.set_checked(true);
                            }
                        }
                        let _ = app.emit("menu", "draw-3");
                    }
                    other => {
                        let _ = app.emit("menu", other);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running app");
}
