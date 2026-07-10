# Gardenerd Product Requirements Document

## 1. Product Summary

Gardenerd is a local-network gardening application designed to help a beginner gardener learn how to grow herbs, vegetables, and eventually homestead-scale food plants through structured observation and simple experimentation.

The first version focuses on container gardening with manually entered Plants, Containers, Growing Trials, Journal Events, photos, and weekly task planning.

Gardenerd is not intended to be a fully automated gardening expert in version one. Its primary purpose is to help the gardener record what they are doing, observe what happens, learn from each Growing Trial, and build better gardening habits over time.

## 2. Product Vision

Gardenerd helps a new gardener understand how plants grow by connecting practical care actions with real outcomes.

The app should help answer questions such as:

- What am I trying to grow?
- Where am I growing it?
- What care guidance do I want to follow?
- What did I do?
- What happened afterward?
- What did I learn?
- What should I check this week?

Over time, Gardenerd should grow from a simple local gardening journal into a deeper homesteading tool that supports plant knowledge, Growing Trial comparisons, analytics, sensors, garden planning, and eventually mobile access through an iOS app.

## 3. Primary User

The primary user is a new gardener who wants to learn how gardening works through hands-on practice.

The user is currently starting with:

- No current plants
- Four 12-inch plastic pots
- Potting mix
- An initial interest in vegetables because they can be eaten
- A desire to eventually start a homestead
- A preference for learning through simple tracking and observation

The app should assume the user is learning and should avoid overwhelming them with advanced gardening terminology or rigid workflows too early.

## 4. Product Principles

Gardenerd should follow these principles:

- Keep version one simple enough to actually use.
- Use "Growing Trial" as the primary product term.
- Favor learning-oriented guidance over rigid automation.
- Help the user build gardening intuition, especially around soil, water, sun, and plant response.
- Avoid forcing detailed analytics before the user knows what they want to compare.
- Make observations easy to record.
- Keep structured data minimal at first.
- Support future expansion without overbuilding the first version.
- Work well from a browser on both mobile and desktop.
- Run locally on the user's network.

## 5. Version 1 Goals

Version one should provide the minimum useful product for managing simple container-based Growing Trials.

Goals:

- Allow the user to define Plants manually.
- Allow the user to define Containers manually.
- Allow the user to create planned Growing Trials.
- Allow the user to start a planned Growing Trial.
- Allow the user to record Journal Events for active Growing Trials.
- Allow the user to attach photos to Journal Events.
- Allow the user to complete or abandon a Growing Trial with a result summary.
- Provide a home dashboard showing active Growing Trials and weekly tasks.
- Generate a simple weekly task list for active Growing Trials.
- Store data in PostgreSQL.
- Store uploaded photos in persistent server-side storage outside Docker containers.
- Run as a local-network browser app with no login.

## 6. Version 1 Non-Goals

Version one should not include:

- User accounts or login
- iOS app
- Built-in plant database
- AI plant diagnosis
- Sensor integrations
- Weather API integration
- Advanced analytics
- Multi-user household support
- Multi-plant Containers
- Garden bed mapping
- Homestead layout planning
- Companion planting engine
- Crop rotation planning
- Automated recommendations beyond basic weekly task generation
- Cloud sync
- Remote access outside the local network

## 7. Core Product Terms

### Plant

A Plant is a manually created record representing something the user may want to grow.

In version one, a Plant is intentionally simple.

A Plant includes:

- Name
- Plain text care notes

Examples:

- Radish
- Lettuce
- Cherry Tomato
- Jalapeno Pepper
- Basil

### Container

A Container is a manually created record representing a physical place where a Plant can be grown.

In version one, a Container is intentionally simple.

A Container includes:

- Name

Examples:

- Pot 1
- Pot 2
- Pot 3
- Pot 4

### Growing Trial

A Growing Trial is one attempt to grow one Plant in one Container.

"Growing Trial" is the primary product term and should be used consistently throughout the application and documentation.

A Growing Trial connects:

- One Plant
- One Container
- A status
- A start date once started
- A start method once started
- Journal Events while active
- A result summary once completed or abandoned

Example:

- Plant: Radish
- Container: Pot 1
- Growing Trial: Radish in Pot 1

### Journal Event

A Journal Event is a dated record of something that happened during an active Growing Trial.

Journal Events are used to track care actions, observations, problems, photos, and harvests.

### Journal Photo

A Journal Photo is an uploaded photo attached to a Journal Event.

Photos are not attached directly to Plants, Containers, or Growing Trials in version one.

### Weekly Task List

A Weekly Task List is a generated list of suggested tasks for active Growing Trials, grouped by day of the week.

The Weekly Task List should help the user plan their gardening activity for the following week and optionally copy tasks to a physical calendar.

## 8. Core Concepts And Relationships

Version one uses a simple relationship model:

- A Plant can be used in many Growing Trials over time.
- A Container can be used in many Growing Trials over time, but only one active Growing Trial should use a Container at a time.
- A Growing Trial links one Plant to one Container.
- A Growing Trial can have many Journal Events.
- A Journal Event belongs to one active Growing Trial.
- A Journal Event can have zero or more Journal Photos.
- Weekly tasks are generated from active Growing Trials.

Version one should support only one Plant per Container per Growing Trial.

## 9. Growing Trial Lifecycle

A Growing Trial has one of the following statuses:

- Planned
- Active
- Completed
- Abandoned

### Planned

A Growing Trial starts as planned.

A planned Growing Trial represents an intention to grow a specific Plant in a specific Container.

Journal Events cannot be added to planned Growing Trials.

### Active

A Growing Trial becomes active when the user starts it.

Starting a Growing Trial records:

- Start date
- Start method

Start method options:

- Seed
- Seedling/transplant

Journal Events can only be added to active Growing Trials.

Weekly tasks are generated only for active Growing Trials.

### Completed

A Growing Trial is completed when the growing attempt has naturally or successfully ended.

When completing a Growing Trial, the user should be able to record a result summary.

### Abandoned

A Growing Trial is abandoned when the user stops it early or decides it failed.

Reasons may include:

- Plant died
- Pest issue
- Disease issue
- Weather issue
- Container issue
- User chose to stop the attempt
- Unknown reason

When abandoning a Growing Trial, the user should be able to record a result summary.

## 10. Result Summary

Completed and abandoned Growing Trials should support a result summary.

The result summary should help the user learn from the Growing Trial.

Suggested fields:

- What happened?
- What worked?
- What did not work?
- What would I change next time?
- Did I harvest anything?
- Overall outcome

Overall outcome options:

- Success
- Partial success
- Failed
- Unknown

## 11. Plant Requirements

The user should be able to:

- Create a Plant.
- View a list of Plants.
- View Plant details.
- Edit a Plant.
- Use a Plant in a Growing Trial.

A Plant should include:

- Name
- Plain text care notes

Plant care notes may include information such as:

- Watering guidance
- Sun guidance
- Germination expectations
- Harvest guidance
- Soil preferences
- Personal notes
- Source notes from seed packets, books, or websites

Version one should not require structured Plant care fields.

## 12. Container Requirements

The user should be able to:

- Create a Container.
- View a list of Containers.
- View Container details.
- Edit a Container.
- Use a Container in a Growing Trial.

A Container should include:

- Name

Version one should not require details such as:

- Size
- Material
- Drainage
- Location
- Soil type

Those fields may be added later.

## 13. Growing Trial Requirements

The user should be able to:

- Create a planned Growing Trial.
- Link the Growing Trial to one Plant.
- Link the Growing Trial to one Container.
- View Growing Trial details.
- View Growing Trials by status.
- Start a planned Growing Trial.
- Complete an active Growing Trial.
- Abandon an active Growing Trial.

A Growing Trial should include:

- Plant
- Container
- Status
- Start date, once active
- Start method, once active
- Result summary, once completed or abandoned
- Created date
- Updated date

Rules:

- A Growing Trial must link to one Plant.
- A Growing Trial must link to one Container.
- A Growing Trial starts as planned.
- Journal Events can only be added to active Growing Trials.
- Weekly tasks are generated only for active Growing Trials.
- One Container should not have more than one active Growing Trial at the same time.

## 14. Journal Requirements

Journal Events should help the user record what happened during an active Growing Trial.

The user should be able to:

- Add a Journal Event to an active Growing Trial.
- View Journal Events for a Growing Trial.
- View a timeline of Journal Events for a Growing Trial.
- Attach photos to a Journal Event.
- Record both structured event type and freeform notes.

A Journal Event should include:

- Growing Trial
- Event type
- Date
- Note
- Optional photos
- Created date
- Updated date

Initial event types:

- Planted
- Watered
- Germinated
- Fertilized
- Pruned
- Harvested
- Problem noticed
- Photo taken
- General observation

Version one should keep Journal Events flexible. The note field should allow the user to write naturally.

Example:

Event type: Watered

Note: Soil felt dry about 1 inch down. Added water until a little drained from the bottom.

## 15. Photo Requirements

Photos are useful for tracking plant growth, problems, and harvests.

Version one should support simple photo uploads attached to Journal Events.

The user should be able to:

- Upload one or more photos to a Journal Event.
- View photos within the Growing Trial timeline.
- Optionally add a caption or note through the Journal Event note.
- Keep photos associated with the date of the Journal Event.

Storage requirements:

- Photo files should be stored outside Docker containers.
- PostgreSQL should store photo metadata and file paths.
- Photo storage should be persistent across container rebuilds.
- Local media storage should be used for version one.
- The design should allow future migration to NAS, S3, MinIO, or another object storage system.

Version one should not include:

- AI photo analysis
- Automatic plant health detection
- Photo comparison tools
- Photo albums independent of Journal Events
- Cover photos for Growing Trials

## 16. Dashboard Requirements

The home dashboard should be the main entry point.

The dashboard should show:

- Weekly tasks grouped by day of the week.
- Growing Trials with a status filter.
- Quick access to add a Journal Event.
- Quick access to start a planned Growing Trial.

Growing Trial filter options:

- Active
- Planned
- Completed
- Abandoned
- All

Default filter:

- Active

The dashboard should prioritize active Growing Trials because those need current attention.

The dashboard should work well on both mobile and desktop browsers.

## 17. Weekly Task Planning Requirements

Gardenerd should generate a simple weekly task list for active Growing Trials.

The Weekly Task List is intended to help the user plan the following week and optionally copy tasks to a physical calendar.

Tasks should be:

- Generated for active Growing Trials only.
- Grouped by day of the week.
- Written in learning-oriented language.
- Simple and non-prescriptive where appropriate.

Preferred task wording examples:

- Check soil moisture for Pot 1.
- Water Pot 1 if the top inch of soil is dry.
- Look for sprouts in Pot 2.
- Add a growth observation for Pot 3.
- Check active Growing Trials for pests or problems.
- Review this week's Growing Trial notes.

Avoid overly rigid task wording such as:

- Water every two days no matter what.
- Fertilize now.
- Harvest today.

Version one may generate basic tasks based on:

- Active Growing Trial status
- Plant care notes existing
- Start date
- Start method
- General beginner gardening habits

Version one does not need to deeply parse Plant care notes into precise schedules.

## 18. Primary User Workflows

### Workflow 1: Create Initial Setup

The user creates:

- Plant records for vegetables they want to grow.
- Container records for their four pots.
- Planned Growing Trials linking Plants to Containers.

### Workflow 2: Start A Growing Trial

The user selects a planned Growing Trial and starts it.

The app records:

- Start date
- Start method

The Growing Trial status changes from planned to active.

### Workflow 3: Record Activity

The user adds Journal Events to an active Growing Trial.

Examples:

- Watered
- Germinated
- Problem noticed
- General observation
- Harvested

The user can attach photos to Journal Events.

### Workflow 4: Review Dashboard

The user opens the dashboard to see:

- Active Growing Trials
- Weekly tasks grouped by day
- Planned Growing Trials if selected in the filter

### Workflow 5: End A Growing Trial

The user completes or abandons a Growing Trial.

The app prompts for a result summary.

The user records what happened and what they learned.

## 19. Data Requirements

Version one data entities:

- Plant
- Container
- Growing Trial
- Journal Event
- Journal Photo

Suggested fields are listed for product clarity. Final database and API design should be handled in a technical specification.

### Plant

- ID
- Name
- Care notes
- Created at
- Updated at

### Container

- ID
- Name
- Created at
- Updated at

### Growing Trial

- ID
- Plant ID
- Container ID
- Status
- Start date
- Start method
- Result summary fields
- Created at
- Updated at

### Journal Event

- ID
- Growing Trial ID
- Event type
- Event date
- Note
- Created at
- Updated at

### Journal Photo

- ID
- Journal Event ID
- File path
- Original filename
- Content type
- File size
- Created at
- Updated at

## 20. Technical Direction

Gardenerd should be built as a monorepo.

Recommended structure:

```text
Gardenerd/
  backend/
    manage.py
    gardenerd/
    apps/
      plants/
      containers/
      growing_trials/
      journal/
      tasks/
      photos/
    tests/
  frontend/
    src/
    app/
    components/
    graphql/
    test/
  data/
    postgres/
    media/
  docker-compose.yml
  README.md
```

Backend:

- Django
- Strawberry GraphQL
- PostgreSQL
- pytest
- Ruff

Frontend:

- Next.js
- React
- TypeScript
- Mantine
- GraphQL client
- Jest
- Playwright
- ESLint
- Prettier

Infrastructure:

- Docker Compose for local development
- PostgreSQL container with persistent host-mounted data
- Backend container
- Frontend container
- Host-mounted media directory for uploaded photos

## 21. Local Network And Deployment Requirements

Version one should run on the user's local network.

Requirements:

- App can be accessed from a browser on desktop.
- App can be accessed from a browser on mobile.
- No login required.
- Data persists across container restarts.
- Uploaded photos persist across container rebuilds.
- Local development setup should be documented in README.

Version one does not need:

- Public internet access
- HTTPS
- Domain name
- User authentication
- Cloud deployment

## 22. Testing Requirements

Testing should support confidence without overcomplicating the first version.

Backend testing:

- Use pytest.
- Test models and validation rules.
- Test GraphQL queries and mutations.
- Test Growing Trial lifecycle rules.
- Test that Journal Events can only be added to active Growing Trials.
- Test that a Container cannot have more than one active Growing Trial at the same time.
- Test photo metadata behavior.

Frontend testing:

- Use Jest for unit/component tests where useful.
- Use Playwright for end-to-end flows.
- Test core user workflows instead of fragile implementation details.

Initial end-to-end flows:

- Create Plant.
- Create Container.
- Create planned Growing Trial.
- Start Growing Trial.
- Add Journal Event.
- View dashboard.
- Complete or abandon Growing Trial.

## 23. Acceptance Criteria

Version one is acceptable when:

- The user can create, view, and edit Plants.
- The user can create, view, and edit Containers.
- The user can create planned Growing Trials.
- A Growing Trial links one Plant to one Container.
- The user can start a planned Growing Trial.
- Starting a Growing Trial records start date and start method.
- Start method options are seed and seedling/transplant.
- The user can view Growing Trials filtered by status.
- The dashboard defaults to active Growing Trials.
- Journal Events can be added to active Growing Trials.
- Journal Events cannot be added to planned, completed, or abandoned Growing Trials.
- Journal Events support event type, date, note, and optional photos.
- Photos are stored outside Docker containers.
- Photo metadata and file paths are stored in PostgreSQL.
- The user can complete or abandon a Growing Trial.
- Completed or abandoned Growing Trials support a result summary.
- Weekly tasks are generated only for active Growing Trials.
- Weekly tasks are grouped by day of the week.
- The app runs locally with Docker Compose.
- Data persists across container restarts.
- The browser UI is usable on desktop and mobile.

## 24. Recommended Build Milestones

### Milestone 1: Local App Skeleton And Core Records

Goal: Establish the monorepo, local development environment, database, API, and basic UI for Plants, Containers, and planned Growing Trials.

This milestone proves the technical foundation works end to end.

Primary outcomes:

- Monorepo exists.
- Docker Compose runs the app locally.
- Django connects to PostgreSQL.
- Next.js frontend runs.
- GraphQL API works.
- Plants can be created and viewed.
- Containers can be created and viewed.
- Planned Growing Trials can be created and viewed.

### Milestone 2: Growing Trial Lifecycle

Goal: Support starting, viewing, completing, and abandoning Growing Trials.

Primary outcomes:

- Planned Growing Trials can be started.
- Start date is recorded.
- Start method is recorded.
- Active Growing Trials are visible.
- Growing Trials can be completed.
- Growing Trials can be abandoned.
- Result summaries can be recorded.

### Milestone 3: Journal And Photos

Goal: Allow the gardener to record dated Journal Events and attach photos to active Growing Trials.

Primary outcomes:

- Journal Events can be added to active Growing Trials.
- Journal Events appear in a Growing Trial timeline.
- Journal Events support event type, date, and note.
- Photos can be uploaded to Journal Events.
- Photos are stored in persistent local media storage.
- Journal photos appear in the Growing Trial timeline.

### Milestone 4: Dashboard And Weekly Tasks

Goal: Provide a useful home dashboard with active Growing Trials and weekly tasks grouped by day.

Primary outcomes:

- Dashboard shows Growing Trials.
- Dashboard supports status filtering.
- Dashboard defaults to active Growing Trials.
- Dashboard shows weekly tasks grouped by day.
- Weekly tasks are generated only for active Growing Trials.
- Weekly tasks use learning-oriented language.

### Milestone 5: First Usability Pass

Goal: Improve the workflow enough that the app is practical to use during real gardening.

Primary outcomes:

- Mobile layout is usable.
- Forms are simple and clear.
- Empty states help guide the user.
- Error states are understandable.
- README explains local setup.
- Core workflows are covered by tests.

## 25. Suggested Initial Jira Structure

The PRD should define product behavior and milestone direction.

Jira should track implementation work as Epics, Stories, and Tasks.

Stories should represent user-visible value where possible.

Tasks should represent technical implementation steps.

### Epic: Gardenerd V1 Foundation

Purpose: Build the first usable local-network version of Gardenerd for simple container-based Growing Trials.

### Story: Create Monorepo Foundation

As the developer, I want a local development setup so I can run Gardenerd consistently.

Suggested tasks:

- Create monorepo structure.
- Add Docker Compose.
- Add PostgreSQL service.
- Add Django backend service.
- Add Next.js frontend service.
- Configure backend environment variables.
- Configure frontend environment variables.
- Add README with local startup instructions.
- Configure Ruff.
- Configure pytest.
- Configure ESLint.
- Configure Prettier.
- Configure Jest.
- Configure Playwright.

Acceptance criteria:

- App services start locally through Docker Compose.
- Backend can connect to PostgreSQL.
- Frontend can load in a browser.
- README documents basic local commands.

### Story: Create Plant Records

As a gardener, I want to create Plants with care notes so I can define what I plan to grow.

Suggested tasks:

- Add Plant model.
- Add Plant database migration.
- Add Plant GraphQL type.
- Add Plant list query.
- Add Plant create mutation.
- Add Plant edit mutation.
- Add Plant list UI.
- Add Plant create/edit UI.
- Add backend tests.
- Add frontend tests where useful.

Acceptance criteria:

- User can create a Plant with name and care notes.
- User can view Plants.
- User can edit Plants.

### Story: Create Container Records

As a gardener, I want to create Containers so I can track where each Growing Trial happens.

Suggested tasks:

- Add Container model.
- Add Container database migration.
- Add Container GraphQL type.
- Add Container list query.
- Add Container create mutation.
- Add Container edit mutation.
- Add Container list UI.
- Add Container create/edit UI.
- Add backend tests.
- Add frontend tests where useful.

Acceptance criteria:

- User can create a Container with a name.
- User can view Containers.
- User can edit Containers.

### Story: Create Planned Growing Trials

As a gardener, I want to create a planned Growing Trial linked to one Plant and one Container so I can prepare what I intend to grow.

Suggested tasks:

- Add Growing Trial model.
- Add status field.
- Add planned status.
- Add Plant relationship.
- Add Container relationship.
- Add database migration.
- Add Growing Trial GraphQL type.
- Add Growing Trial list query.
- Add Growing Trial create mutation.
- Add Growing Trial list UI.
- Add Growing Trial create UI.
- Add validation for required Plant and Container.
- Add backend tests.
- Add frontend tests where useful.

Acceptance criteria:

- User can create a planned Growing Trial.
- Growing Trial links one Plant to one Container.
- New Growing Trials start as planned.
- User can view planned Growing Trials.

### Story: Start A Growing Trial

As a gardener, I want to start a planned Growing Trial so I can begin tracking an actual growing attempt.

Suggested tasks:

- Add start date field.
- Add start method field.
- Add seed start method.
- Add seedling/transplant start method.
- Add mutation to start a Growing Trial.
- Add UI action to start a planned Growing Trial.
- Add validation that only planned Growing Trials can be started.
- Add backend tests.
- Add frontend tests where useful.

Acceptance criteria:

- User can start a planned Growing Trial.
- Start date is recorded.
- Start method is recorded.
- Status changes to active.
- User cannot start an already active, completed, or abandoned Growing Trial.

### Story: View Growing Trial Dashboard

As a gardener, I want a dashboard showing Growing Trials so I can quickly see what I am working on.

Suggested tasks:

- Add dashboard route.
- Add Growing Trial section.
- Add status filter.
- Default filter to active.
- Add planned filter.
- Add completed filter.
- Add abandoned filter.
- Add all filter.
- Add responsive layout.
- Add empty states.

Acceptance criteria:

- Dashboard loads as the home page.
- Dashboard shows Growing Trials.
- Dashboard defaults to active Growing Trials.
- User can filter by status.
- Dashboard is usable on mobile and desktop.

### Story: Add Journal Events

As a gardener, I want to add Journal Events to active Growing Trials so I can record what I did and observed.

Suggested tasks:

- Add Journal Event model.
- Add event type field.
- Add event date field.
- Add note field.
- Add Growing Trial relationship.
- Add database migration.
- Add Journal Event GraphQL type.
- Add Journal Event create mutation.
- Add Journal Event timeline query.
- Add Journal Event form UI.
- Add Growing Trial timeline UI.
- Add validation that Journal Events only attach to active Growing Trials.
- Add backend tests.
- Add frontend tests where useful.

Acceptance criteria:

- User can add Journal Events to active Growing Trials.
- User cannot add Journal Events to planned, completed, or abandoned Growing Trials.
- Journal Events appear in the Growing Trial timeline.

### Story: Attach Photos To Journal Events

As a gardener, I want to attach photos to Journal Events so I can visually track plant growth and problems.

Suggested tasks:

- Configure Django media settings.
- Add persistent media directory.
- Add Journal Photo model.
- Add photo upload endpoint or GraphQL-compatible upload flow.
- Store photo metadata in PostgreSQL.
- Store photo files outside Docker containers.
- Add UI for uploading photos to a Journal Event.
- Show photos in the Growing Trial timeline.
- Add backend tests.
- Add frontend tests where useful.

Acceptance criteria:

- User can upload photos to a Journal Event.
- Uploaded photos persist across container rebuilds.
- Photo metadata is stored in PostgreSQL.
- Photos display in the Growing Trial timeline.

### Story: Complete Or Abandon A Growing Trial

As a gardener, I want to complete or abandon a Growing Trial with a result summary so I can learn from the outcome.

Suggested tasks:

- Add result summary fields.
- Add overall outcome field.
- Add complete mutation.
- Add abandon mutation.
- Add complete/abandon UI.
- Add validation for valid status transitions.
- Add backend tests.
- Add frontend tests where useful.

Acceptance criteria:

- User can complete an active Growing Trial.
- User can abandon an active Growing Trial.
- User can record what happened.
- User can record what worked.
- User can record what did not work.
- User can record what to change next time.
- User can record whether anything was harvested.
- User can choose an overall outcome.

### Story: Generate Weekly Task List

As a gardener, I want a weekly task list grouped by day so I can plan my gardening work for the week.

Suggested tasks:

- Define initial task generation rules.
- Generate tasks for active Growing Trials only.
- Group tasks by day of week.
- Add weekly task section to dashboard.
- Add learning-oriented task wording.
- Add backend tests or frontend tests as appropriate.

Acceptance criteria:

- Weekly tasks are shown on the dashboard.
- Tasks are grouped by day.
- Tasks are generated only for active Growing Trials.
- Task wording encourages checking and observing rather than blindly following rigid instructions.

## 26. Future Enhancements

Future versions may include:

- iOS app
- User accounts
- Multi-user household support
- Built-in beginner plant library
- Structured Plant care rules
- Better task generation from structured care rules
- Growing Trial analytics
- Comparison between Growing Trials
- Charts for watering, germination, harvests, and outcomes
- Sensor integrations
- Soil moisture tracking
- Temperature and humidity tracking
- Light tracking
- Weather API integration
- Garden layout and maps
- Raised bed support
- In-ground planting support
- Multi-plant Containers
- Companion planting guidance
- Crop rotation planning
- Succession planting
- Homestead planning
- Advanced photo timeline
- AI-assisted plant issue review
- NAS, S3, MinIO, or object storage support
- Remote access option
- Offline-first mobile experience

## 27. Open Questions

These questions do not block version one but should be revisited later:

- What vegetables will be used for the first real Growing Trials?
- Should Plant care notes eventually become structured rules?
- What task generation logic is useful after the first few Growing Trials?
- Should Containers eventually track size, material, drainage, and location?
- Should soil details be tracked at the Container level or Growing Trial level?
- Should sun exposure be tracked manually?
- Should watering be tracked with amount, method, or just notes?
- Should completed Growing Trials support numeric ratings?
- What analytics will actually help the user learn?
- What storage option should replace local media storage if the app grows?
- When should the iOS app become a priority?
