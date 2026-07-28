"""SP7 — Test: add an assignment via the assignment form."""
import pytest
from selenium.webdriver.common.by import By
from conftest import (
    navigate, click, fill, submit_and_wait,
    open_dialog_combobox, pick_first_option,
)

ASSIGNMENT_NAME = "Selenium Pop Quiz"


def test_add_assignment(driver):
    navigate(driver, "/assignments")

    click(driver, "button-add-assignment")

    # course_id — first combobox inside the dialog (required, no default)
    open_dialog_combobox(driver, index=0)
    pick_first_option(driver)

    # assignment name, max score, weight
    fill(driver, "input-assignment-name", ASSIGNMENT_NAME)
    fill(driver, "input-max-score",       "25")
    fill(driver, "input-weight",          "0.10")

    # type — second combobox inside the dialog (required, no default)
    open_dialog_combobox(driver, index=1)
    pick_first_option(driver)

    submit_and_wait(driver, "button-submit-assignment")

    page_text = driver.find_element(By.TAG_NAME, "body").text
    assert ASSIGNMENT_NAME in page_text, (
        f"Expected '{ASSIGNMENT_NAME}' on page after creation. "
        f"Snippet: {page_text[:400]!r}"
    )
