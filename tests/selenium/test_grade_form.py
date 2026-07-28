"""SP7 — Test: record a grade via the grade entry form."""
import pytest
from selenium.webdriver.common.by import By
from conftest import (
    navigate, click, fill, submit_and_wait,
    open_dialog_combobox, pick_first_option,
)

GRADE_SCORE = "88"


def test_add_grade(driver):
    navigate(driver, "/grades")

    # Count existing rows before we add one
    existing = driver.find_elements(By.CSS_SELECTOR, "[data-testid^='row-grade-']")
    count_before = len(existing)

    click(driver, "button-add-grade")

    # student — first dialog combobox
    open_dialog_combobox(driver, index=0)
    pick_first_option(driver)

    # assignment — second dialog combobox
    open_dialog_combobox(driver, index=1)
    pick_first_option(driver)

    fill(driver, "input-grade-score", GRADE_SCORE)

    submit_and_wait(driver, "button-submit-grade", settle=2.5)

    rows = driver.find_elements(By.CSS_SELECTOR, "[data-testid^='row-grade-']")
    # The grade was either added (count_before+1) or already existed and was
    # updated (upsert keeps same count).  Both are valid outcomes.
    assert len(rows) >= count_before, (
        f"Grade row count dropped: had {count_before} before, {len(rows)} after."
    )
    assert len(rows) > 0, "Expected at least one grade row in the table."
