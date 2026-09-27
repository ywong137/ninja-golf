# Four original nine-hole courses

All layouts use metres. Each course contains nine holes with its own terrain, plants, buildings, sky, and light.

| Course | Setting | Par | Visible features |
| --- | --- | --- | --- |
| Crane Coast | Japanese coastal gardens | 36 | Existing pine models, temple roofs, stone lanterns, ocean, and warm daylight |
| Heather & Crown | Scottish Highland links | 36 | Low heather, golden gorse, sparse conifers, ruined keeps, and cool light |
| Copper Saguaro | Sonoran desert resort | 36 | Branched cacti, palms, agave, sandstone mesas, flat resort roofs, and warm sun |
| Neo-Tokyo After Dark | Fictional future city | 36 | Glowing geometric trees, neon towers, floating koi, a suspended moon, and a dark sky |

The first three Crane Coast holes retain their original dimensions and hazards. Six new holes extend that round.
Each new hole has an authored hazard plan, elevation changes, and a strategy description.
Distinct landing shelves, pot bunkers, crossing hazards, and elevated greens change the shot decisions.
Neo-Tokyo adds a second sinusoidal bend to make serpentine fairways. Its giant floating objects remain outside the shot corridor.

## References and design choices

I read these official pages with `agent-browser` on 26 September 2026.
The layouts are original. They do not reproduce a real hole or its dimensions.

- [Kawana Hotel golf](https://www.princehotels.com/kawana/facilities/kawanagolf/) describes two courses beside the shore, with ocean and mountain views. Crane Coast uses that broad coastal setting.
- [Royal Dornoch](https://royaldornoch.com/) describes tiered linksland beside the firth, a beach, and gorse-covered slopes. Heather & Crown uses open ground, gorse, and a cool coastal horizon.
- [We-Ko-Pa Saguaro](https://wekopa.com/saguaro-course/) describes wide desert corridors, natural elevation changes, and a course designed for walking. Copper Saguaro uses wide landing areas, winding turf, and dry terrain around the holes.

Stone ruins, temple gardens, resort buildings, and all Neo-Tokyo scenery are artistic additions.
Neo-Tokyo keeps normal golf physics. Its winding routes and oversized scenery supply the unusual setting.

## Playable ground and cover

`heightAt`, `lieAt`, and the terrain shader use the same course parameters.
The shader repeats the analytic centre line, including Neo-Tokyo's second bend.
Inland courses disable both the coastal water hazard and the coastal terrain slope.
The existing pond depression and water surface stay in place.

Every hole has a dry tee and a dry green. Bunker centres remain outside water.
Each hole uses at most four bunkers, which matches the shader limit.
The route leaves dry ground around each pond for walking.
Small stones and illuminated posts offer cover beside the fairway. Large buildings stay outside the main corridor.
Plants and cover register with the existing ambush and collision systems.

## Rendering cost and checks

Each repeated plant component uses one instanced mesh. Static buildings merge by material.
Curved palm fronds have paired leaflets. Cacti have ribs and rounded arms.
Scanned rock textures cover masonry blocks and irregular desert mesas.
The Highland course reuses the detailed pine models at a lower density.
Daytime courses share the photographic sky with different exposure and rotation.
The city uses a procedural gradient with stars and thin clouds.
Each new theme uses fewer than 22 scenery draw calls before common terrain, water, and game objects.
The themes add no downloaded textures or models.
The desert and city skip close grass blades. Existing textures supply surface detail.

`tests/course-sets.test.js` checks all 36 hole identities, tees, greens, hazard centres, inland water rules, and neon centre lines.
It also builds each new theme and checks batching and cover registration.
The test suite does not claim a hardware frame rate. Browser checks must measure the complete game.
