use tauri::menu::{
    MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();

            // ---- Game menu ----
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

            // ---- Edit menu ----
            let undo = MenuItemBuilder::with_id("undo", "Undo")
                .accelerator("CmdOrCtrl+Z")
                .build(handle)?;
            let hint = MenuItemBuilder::with_id("hint", "Hint")
                .accelerator("H")
                .build(handle)?;
            let auto_complete = MenuItemBuilder::with_id("auto-complete", "Auto-Complete")
                .accelerator("CmdOrCtrl+A")
                .build(handle)?;

            let edit_menu = SubmenuBuilder::new(handle, "&Edit")
                .item(&undo)
                .separator()
                .item(&hint)
                .item(&auto_complete)
                .build()?;

            // ---- View menu ----
            let fullscreen = PredefinedMenuItem::fullscreen(handle, Some("Toggle Full Screen"))?;
            let view_menu = SubmenuBuilder::new(handle, "&View")
                .item(&fullscreen)
                .build()?;

            // ---- Help menu ----
            let how_to_play =
                MenuItemBuilder::with_id("how-to-play", "How to Play").build(handle)?;
            let about = MenuItemBuilder::with_id("about", "About").build(handle)?;
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

            app.on_menu_event(move |app, event| {
                let _ = app.emit("menu", event.id().as_ref());
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running Solitaire app");
}
