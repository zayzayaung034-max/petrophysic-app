import database, sqlalchemy

with database.engine.connect() as conn:
    tables = conn.execute(sqlalchemy.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    updated = False
    for (tbl,) in tables:
        if tbl.startswith("sqlite_"):
            continue
        try:
            res = conn.execute(
                sqlalchemy.text(f"UPDATE {tbl} SET is_paid = 1 WHERE email = :e"),
                {"e": "zayzayaung034@gmail.com"}
            )
            conn.commit()
            if res.rowcount > 0:
                print(f"SUCCESS: Upgraded {res.rowcount} user record in table '{tbl}' to PRO!")
                updated = True
        except Exception:
            pass

    if not updated:
        print("NOTICE: Account 'zayzayaung034@gmail.com' was not found in any database table.")
        print("Please register on the frontend (http://localhost:5173) first, then rerun this script.")
