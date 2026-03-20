
# Investigation Report: Package Type Data Structure and Flow

## 1. Executive Summary
The core issue preventing the "Jenis Paket" (Package Type) field from initializing correctly in edit modals is a **data type mismatch between stored data (Text Labels) and dropdown options (UUIDs)**. 

The `daily_recaps` table stores the package type as a text string (e.g., "REGULER") in the `package_type` column. However, the form dropdown components (specifically in `DailyRecapModal.jsx`) fetch options from `operational_options` where the `value` is mapped to the UUID of the option. When the form attempts to bind the text string "REGULER" to a dropdown expecting a UUID, the binding fails, resulting in an empty field.

## 2. Database Schema Analysis

### `daily_recaps` Table
- `id`: UUID (Primary Key)
- `package_type`: TEXT (Stores the label, e.g., "REGULER")
- `package_tracking_id`: UUID (Foreign Key to `package_tracking` table, nullable)
*Note: This table does NOT store a direct `package_type_id` (UUID mapping to `operational_options`).*

### `package_tracking` Table
- `id`: UUID (Primary Key)
- `package_type_id`: UUID (Foreign Key to `operational_options`)
- `package_name`: TEXT (Stores the label)

### `operational_options` Table
- `id`: UUID (Primary Key)
- `category`: TEXT (e.g., "tipe_paket")
- `label`: TEXT (e.g., "REGULER")
- `session_count`: INTEGER
- `validity_days`: INTEGER

## 3. API/Query Investigation (`src/lib/api.js` & `src/lib/dailyRecapHelpers.js`)

**Fetching Recaps (`getDailyRecaps` in `api.js`):**
Returns `package_type` as text. There is an `enrichRecapsWithOptions` helper, but it maps ID -> Label. Since `daily_recaps.package_type` is already a label, it remains a text string.

**Fetching Package Options:**
There is a severe inconsistency in how package options are fetched across the application:

1. In `src/lib/api.js` (`getPackageOptions` / `getOperationalOptionsByCategory`):
   