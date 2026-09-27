# Tee markers

`buildTeeMarkers(root, course, {stoneColor, stoneNormal})` adds a named group and returns it.
Both texture arguments are optional. The builder shares them without changing or disposing them.
The world's usual geometry and material cleanup owns the four merged meshes.

Each marker measures 24 cm wide, 19 cm high, and 18 cm deep.
The pair sits 3.4 metres either side of the ball, perpendicular to the opening route.
The rounded bases follow the local ground slope and sit 6 mm below its surface.
The small enamel disc faces the golfer. A narrow rim and chevron identify it without a large sign.

The finishes use basalt and red enamel in Japan, granite and slate blue in the Highlands,
warm sandstone and ochre in the desert, and dark metal with restrained cyan in the city.
The city inset has a small emissive contribution; it does not add a light.

The pair needs three material draws and one contact-occlusion draw and fewer than 2,500 triangles.
Tests cover every course's route alignment, stance clearance, ground contact, shared textures, and geometry cost.

A small rounded contact footprint follows the rendered terrain triangles.
It keeps the small marker grounded despite the larger global shadow bias needed for trees.
