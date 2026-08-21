Claude Prompt — MMM-Chores

I am building a custom MagicMirror² touchscreen module called MMM-Chores.

Build this as a production-quality MagicMirror² module using JavaScript/Node.js.

This module will be used to manage and track daily chores for three children:

Luke
Noah
Annalise

The module is designed specifically for a touchscreen MagicMirror, so all interactive elements need to be large and easy to touch.

PURPOSE

The module displays a daily chore board with four columns:

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ LUKE │ NOAH │ ANNALISE │ EXTRAS │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ │ │ │ │
│ Wash dishes │ Feed dogs │ Make beds │ Wash car │
│ ○ │ ✓ │ ○ │ ○ │
│ │ │ │ │
│ Sweep floor │ Empty │ Clean room │ Clean garage │
│ ○ │ dishwasher │ ✓ │ ○ │
│ │ ○ │ │ │
└──────────────┴──────────────┴──────────────┴──────────────┘

              [ RESET TODAY ]  [ ROTATE WEEK ]

Each individual chore is represented as a chore tile.

Touching a chore tile toggles its completion state.

CRITICAL ARCHITECTURAL REQUIREMENT — CHORE SETS

Do NOT permanently assign chores to Luke, Noah, or Annalise.

There are exactly three chore sets:

Set A
Set B
Set C

The chores belong to these sets.

The children are assigned sets.

The weekly rotation changes which child receives which set.

This is extremely important because I do NOT want to manually move 15–20 chores every week.

For example:

Week 1
Luke → Set A
Noah → Set B
Annalise → Set C
Rotate Week

The sets move from left to right:

Set A → Noah
Set B → Annalise
Set C → Luke

Result:

Week 2
Luke → Set C
Noah → Set A
Annalise → Set B

The next rotation:

Week 3
Luke → Set B
Noah → Set C
Annalise → Set A

The next rotation returns to:

Week 4
Luke → Set A
Noah → Set B
Annalise → Set C

Therefore the rotation is a three-week cycle.

Implement the rotation by changing the set-to-child assignment, NOT by physically moving every chore between data structures.

ROTATE WEEK BUTTON

Provide a large touchscreen button:

[ ROTATE WEEK ]

When pressed, it should rotate the three chore sets from left to right.

The intended behavior is:

Luke ← Set A
Noah ← Set B
Annalise ← Set C

             ↓

Luke ← Set C
Noah ← Set A
Annalise ← Set B

Then:

             ↓

Luke ← Set B
Noah ← Set C
Annalise ← Set A

Then:

             ↓

Luke ← Set A
Noah ← Set B
Annalise ← Set C

The rotation should be persisted to chores.json.

MagicMirror should not need to be restarted.

The UI should immediately update after rotation.

IMPORTANT — EXTRAS DO NOT ROTATE

The fourth column is:

EXTRAS

Extras are completely independent of the three chore sets.

Extras:

Do NOT belong to Set A, B, or C.
Do NOT rotate.
Do NOT move when ROTATE WEEK is pressed.
Always remain in the fourth column.
Can be individually assigned to one of the three chore sets.

Example:

Week 1

LUKE NOAH ANNALISE EXTRAS
Set A Set B Set C Extra Chores

---

Wash dishes Feed dogs Make beds Wash car
Sweep Trash Clean room Clean garage

After ROTATE WEEK:

LUKE NOAH ANNALISE EXTRAS
Set C Set A Set B Extra Chores

---

Make beds Wash dishes Feed dogs Wash car
Clean room Sweep Trash Clean garage

The Extras column remains unchanged.

CHORE TILE

Every chore should be displayed as a touchable tile.

Example:

┌─────────────────────┐
│ │
│ Wash Dishes │
│ │
│ ○ │
│ │
└─────────────────────┘

When incomplete:

○

Use an empty circle or another clearly recognizable incomplete indicator.

When completed:

✓

The completed tile should visually change to indicate completion.

For example:

┌─────────────────────┐
│ │
│ Wash Dishes │
│ │
│ ✓ │
│ │
└─────────────────────┘

The completed state should use a green checkmark.

Do not require a tiny checkbox.

The entire tile should be touchable.

COMPLETION BEHAVIOR

Touching anywhere on a chore tile should toggle its state.

For example:

Incomplete
↓ touch
Completed
↓ touch
Incomplete

The completed state is only intended to represent the current day's completion.

I am NOT concerned about preserving completion state across a MagicMirror restart.

Therefore:

Persist the chore definitions and assignments.
Do NOT need to persist today's completion state.
When MagicMirror starts, chores may start as incomplete.
Resetting chores should also clear all completion states.
RESET TODAY

Provide a button:

[ RESET TODAY ]

When pressed, display a confirmation dialog.

For example:

┌─────────────────────────────────────┐
│ │
│ Reset all chores? │
│ │
│ All completed chores will become │
│ incomplete. │
│ │
│ [ CANCEL ] [ RESET ] │
│ │
└─────────────────────────────────────┘

Only reset the completion state.

Do NOT:

change chore assignments
rotate chore sets
remove chores
modify Extras
modify the chore library
NEW CHORE

Provide a way to add a new chore.

Use a button such as:

[ + NEW CHORE ]

When selected, display a touchscreen-friendly input dialog.

Example:

┌─────────────────────────────────────┐
│ NEW CHORE │
│ │
│ [ Wash the dog__________________ ] │
│ │
│ [ CANCEL ] [ ADD ] │
└─────────────────────────────────────┘

When a new chore is created:

It MUST initially be added to Extras.

Do not automatically assign it to Luke, Noah, or Annalise.

The new chore should immediately appear in the Extras column.

The new chore must be persisted to:

chores.json

so that it survives MagicMirror restarts.

ASSIGNING EXTRA CHORES TO A SET

I need the ability to take a chore from Extras and assign it to one of the three chore sets.

For example:

Extras

┌─────────────────────┐
│ Wash the car │
│ ○ │
└─────────────────────┘

I should have a way to assign it:

Assign chore to:

[ Extras ▼ ]

          or

[ Set A ▼ ]
[ Set B ▼ ]
[ Set C ▼ ]

A dropdown/select control is acceptable.

The exact UI can be designed appropriately for a touchscreen.

When I assign:

Wash the car → Set B

it should disappear from Extras and become part of Set B.

The important distinction is:

Set A/B/C are the underlying chore groups.

Luke/Noah/Annalise are merely the people currently assigned those sets.

Therefore, if:

Wash the car → Set B

and Set B is currently assigned to Noah, Noah sees:

Wash the car

If I rotate the week and Set B moves to Annalise, Annalise sees:

Wash the car

I should NOT have to change the chore assignment when the week rotates.

MOVING CHORES BETWEEN SETS

I need the ability to change the underlying chore sets in the future.

At minimum, the architecture must support moving a chore:

Set A → Set B
Set B → Set C
Set C → Set A

and:

Set A → Extras
Set B → Extras
Set C → Extras

and:

Extras → Set A
Extras → Set B
Extras → Set C

This does NOT necessarily need to be exposed as a full drag-and-drop interface in the first version.

A simple management mechanism is acceptable.

For example, tapping a chore could provide an option:

Wash Dishes

Completed

Assign to:
[ Set A ▼ ]

[ SAVE ]

Or another simple touchscreen-friendly approach.

The important requirement is that I can modify the underlying chore set assignment without editing the source code.

CHORE DATA MODEL

Use a data model similar to:

{
id: "unique-id",
name: "Wash dishes",
group: "setA"
}

Possible group values:

setA
setB
setC
extras

Do NOT store:

child: "Luke"

on the chore.

The chore belongs to a set.

The current rotation determines which child receives that set.

ROTATION DATA MODEL

Persist the current assignment of sets to children.

For example:

{
rotation: {
Luke: "setA",
Noah: "setB",
Annalise: "setC"
}
}

After rotation:

{
rotation: {
Luke: "setC",
Noah: "setA",
Annalise: "setB"
}
}

This is preferable to modifying every chore's assignment.

PERSISTENCE

Use a local JSON file:

MMM-Chores/
chores.json

The JSON should persist:

chore definitions
chore names
chore IDs
chore set assignment
current set rotation

It does NOT need to persist today's completed/unfinished state.

Example conceptual structure:

{
"rotation": {
"Luke": "setA",
"Noah": "setB",
"Annalise": "setC"
},

    "chores": [
        {
            "id": "1",
            "name": "Wash dishes",
            "group": "setA"
        },
        {
            "id": "2",
            "name": "Empty dishwasher",
            "group": "setB"
        },
        {
            "id": "3",
            "name": "Take out trash",
            "group": "setC"
        },
        {
            "id": "4",
            "name": "Wash car",
            "group": "extras"
        }
    ]

}

The exact schema may be improved if there is a better design.

INITIAL CHORE DATA

The module should support an initial static list of chores.

I will populate the initial chores.json with my actual chores.

Do not hard-code a large list of chores into JavaScript.

The data should be separate from the module code.

For development, include a small sample dataset such as:

Set A:

Wash dishes
Sweep kitchen
Clean table

Set B:

Empty dishwasher
Feed dogs
Take out trash

Set C:

Make beds
Clean room
Fold laundry

Extras:

Wash car
Clean garage
WEEKLY ROTATION

Do NOT automatically rotate based on the calendar at this point.

The rotation should happen when I explicitly press:

ROTATE WEEK

This is intentional.

Do not automatically rotate every Monday.

The button should be the authoritative mechanism for changing the rotation.

The current rotation must be persisted.

VISUAL DESIGN

The design should fit the existing MagicMirror aesthetic.

The current MagicMirror uses:

Black background
Gray/white text
Colored calendar/event elements
Minimalist design
Large readable text
Dark tiles
Thin borders

Use a similar visual style.

The chore board should feel like a natural part of the MagicMirror rather than a separate web application.

FOUR-COLUMN LAYOUT

The main layout should be:

┌─────────────────────────────────────────────────────────────┐
│ │
│ CHORES │
│ │
├──────────────────┬──────────────────┬───────────────────────┤
│ LUKE │ NOAH │ ANNALISE │
├──────────────────┼──────────────────┼───────────────────────┤
│ │ │ │
│ ┌────────────┐ │ ┌────────────┐ │ ┌────────────┐ │
│ │ Wash │ │ │ Feed Dogs │ │ │ Make Beds │ │
│ │ Dishes ○ │ │ │ ✓ │ │ │ ○ │ │
│ └────────────┘ │ └────────────┘ │ └────────────┘ │
│ │ │ │
│ ┌────────────┐ │ ┌────────────┐ │ ┌────────────┐ │
│ │ Sweep │ │ │ Empty │ │ │ Clean Room │ │
│ │ Kitchen ○ │ │ │ Dishwasher○│ │ │ ✓ │ │
│ └────────────┘ │ └────────────┘ │ └────────────┘ │
│ │ │ │
├──────────────────┴──────────────────┴───────────────────────┤
│ EXTRAS │
│ │
│ OR │
│ │
│ Use a fourth equal-width column if that fits the screen │
└─────────────────────────────────────────────────────────────┘

The preferred layout is four equal-width columns:

Luke | Noah | Annalise | Extras

Each column should independently scroll if necessary rather than causing the entire page to become unusable.

TOUCHSCREEN REQUIREMENTS

This is specifically designed for touchscreen use.

Every interactive element needs a sufficiently large touch target.

The following should be touchable:

Chore tiles
New Chore
Reset Today
Rotate Week
Chore assignment controls
Confirmation dialog buttons

Avoid tiny controls.

Do not rely on hover states.

Provide clear pressed/touched states.

BUTTON PLACEMENT

Place management controls in a clear area that does not interfere with the chore columns.

For example:

[ + NEW CHORE ] [ RESET TODAY ] [ ROTATE WEEK ]

These should be large enough to touch comfortably.

ROTATION FEEDBACK

When I press ROTATE WEEK, provide a clear indication that the rotation occurred.

For example:

Week rotated

or a brief visual transition.

The columns should update immediately.

For example:

Before:

LUKE NOAH ANNALISE
Set A Set B Set C

After:

LUKE NOAH ANNALISE
Set C Set A Set B

Do not reload MagicMirror.

MAGICMIRROR ARCHITECTURE

Use standard MagicMirror module architecture.

Create:

MMM-Chores/
MMM-Chores.js
MMM-Chores.css
node_helper.js
package.json
chores.json
README.md

Use:

Module.register()

and appropriate MagicMirror lifecycle methods.

The frontend module should handle:

rendering
touch interaction
completion state
dialogs
UI updates

node_helper.js should handle:

reading chores.json
writing chores.json
persistence
rotation changes
chore creation
chore assignment changes

Use MagicMirror socket notifications for communication between the frontend and node helper where appropriate.

PERSISTENCE SAFETY

When writing chores.json:

Do not corrupt the file if MagicMirror is interrupted.
Validate data where practical.
Handle a missing chores.json.
If the file does not exist, create it with the initial sample/default structure.
Handle malformed JSON gracefully.
Log useful errors.

Do not require a database.

Do not require an internet connection.

COMPLETION STATE

Completion state can remain in frontend memory.

For example:

completedChores = new Set();

When the page loads:

all chores = incomplete

When a chore is touched:

incomplete → complete
complete → incomplete

When Reset Today is confirmed:

completedChores.clear()

Do not persist completion state to chores.json.

CHORE ASSIGNMENT UI

I want the ability to manage the underlying set assignment.

Do not make this confusing for normal daily use.

The primary interaction should remain:

Touch chore → complete

Management actions can be accessed through a secondary interaction or management button.

For example, a chore could have a small management/edit control, or touching/holding a chore could open an edit dialog.

Choose an approach that works well on a touchscreen.

The management UI should allow:

Chore:
Wash dishes

Assign to:

[ Set A ▼ ]

Options:

Set A
Set B
Set C
Extras

[ CANCEL ] [ SAVE ]

Changing the assignment should immediately update the appropriate column.

IMPORTANT DISTINCTION

Do not confuse:

Chore Set

with:

Child

The data model should be:

Chore
↓
Set A / Set B / Set C / Extras
↓
Current Rotation
↓
Luke / Noah / Annalise

NOT:

Chore
↓
Luke

This distinction is what makes the weekly rotation easy.

EXAMPLE

Suppose the initial configuration is:

Set A:
Wash dishes
Sweep kitchen
Clean table

Set B:
Empty dishwasher
Feed dogs
Take out trash

Set C:
Make beds
Clean room
Fold laundry

Extras:
Wash car
Clean garage

Initial rotation:

Luke → Set A
Noah → Set B
Annalise → Set C

The screen shows:

LUKE NOAH ANNALISE EXTRAS

Wash dishes ○ Empty dishwasher ○ Make beds ○ Wash car ○

Sweep kitchen ○ Feed dogs ○ Clean room ○ Clean garage ○

Clean table ○ Take out trash ○ Fold laundry ○

Press:

ROTATE WEEK

The screen becomes:

LUKE NOAH ANNALISE EXTRAS

Make beds ○ Wash dishes ○ Empty dishwasher ○ Wash car ○

Clean room ○ Sweep kitchen ○ Feed dogs ○ Clean garage ○

Fold laundry ○ Clean table ○ Take out trash ○

No individual chore was moved.

Only the rotation mapping changed.

NEW CHORE EXAMPLE

I press:

- NEW CHORE

Enter:

Mow the lawn

The new chore appears in:

EXTRAS

Then I choose:

Mow the lawn
Assign to → Set A

Now it appears in Set A.

If Set A currently belongs to Luke, Luke sees it.

After the next rotation, Set A may belong to Noah, and Noah will see it.

The chore itself never needs to know who the child is.

FUTURE EXTENSIBILITY

Design this so the following could be added later without rewriting the core architecture:

Automatic weekly rotation
Chore history
Points/rewards
Child-specific dashboards
Daily/weekly statistics
Different chore frequencies
Chores that occur only on certain days
Due dates
Notifications/reminders
Additional children
Drag-and-drop chore assignment
More chore sets

Do NOT implement these features now.

Build a clean foundation that doesn't prevent them later.

CONFIGURATION

The module configuration should be simple.

For example:

{
module: "MMM-Chores",
position: "middle_center",

    config: {
        title: "Chores",
        showManagementControls: true
    }

}

Do not put the actual chore list in config.js.

The chore data belongs in chores.json.

README

Create a complete README explaining:

What MMM-Chores does.
Installation.
Configuration.
The four-column layout.
How chore sets work.
How weekly rotation works.
How Extras work.
How to add a new chore.
How to assign a chore to a set.
How to modify the initial chore data.
How persistence works.
How to reset daily completion.
How to rotate the week.
How to troubleshoot chores.json.

Include an example chores.json.

BEFORE WRITING CODE

Before creating or modifying files, inspect the existing MagicMirror project and explain:

Where the new module should live.
How the module will communicate with node_helper.js.
How chores.json will be persisted.
How the Set A/B/C rotation will work.
How Extras will remain independent of the rotation.
How chore completion will be tracked.
How the touchscreen interactions will work.
How the chore assignment UI will work.
How the module will avoid requiring a MagicMirror restart after adding/assigning/rotating chores.

Then implement the module.

After implementation, explain:

Every file created.
What needs to be added to config.js.
How to populate chores.json.
How the rotation works.
How to add a chore.
How to move a chore between sets.
How to move a chore back to Extras.
How to reset today's chores.
How to rotate the week.
How to test the touchscreen interactions.

Do not ask me to manually move chores between children each week.

The entire purpose of the Set A/B/C architecture is to make weekly rotation a single-button operation.

1Password menu is available. Press down arrow to select.
