# Government Loss Dashboard

Interactive dashboard tracking **losses of public money or property** as reported in the [Public Accounts of Canada](https://open.canada.ca/data/en/dataset/3b936f0d-4ea2-4aca-b60e-e53aead6ad69).

**Live Dashboard:** https://georgetaylor3978.github.io/Government-Loss/

---

## Data Coverage

- **Years:** 2006 – 2025
- **Incidents:** 11 distinct incident categories
- **Departments:** 106 federal departments
- **Portfolios:** 28 government portfolios

---

## File Structure

| File | Purpose |
|------|---------|
| `GovtLossData.csv` | Raw loss records from Public Accounts |
| `GovtLossMapped.csv` | Normalized mapping: Incident→LossType, Dept→Portfolio |
| `process_data.js` | Node.js script that compiles `data.json` from CSVs |
| `data.json` | Compiled data file consumed by the dashboard |
| `index.html` | Dashboard HTML |
| `index.css` | Styles |
| `app.js` | Dashboard logic (Chart.js) |
| `update.bat` | One-click rebuild & deploy script |

---

## Updating the Data

1. Edit `GovtLossData.csv` to add new records (keep the same column headers).
2. Edit `GovtLossMapped.csv` to add new incident types or departments (use the `TableName` column format).
3. Double-click `update.bat` to rebuild `data.json` and push to GitHub.

---

## GovtLossMapped.csv Format

The mapping file uses a unified single-table format with a `TableName` discriminator:

```
TableName,  [keys and values specific to that table]
```

**IncidentType rows:** `TableName=IncidentType`
```
TableName, IncidentCode, Incident, LossTypeCode, LossType
```

**Department rows:** `TableName=Department`
```
TableName, DeptNbr, Department, PortfolioCode, Portfolio
```

Lines starting with `#` are comments. This format allows both tables to live in one file
and be extended simply by adding rows at the bottom.

---

## Local Development

```bash
node process_data.js
# Then open index.html in a browser (use Live Server or similar for fetch() to work)
```

---

*Built with Chart.js · Data: Open Canada · Dashboard by WizRed*
