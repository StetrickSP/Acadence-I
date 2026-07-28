"""SP7 — Test: add a student via the student form."""
import pytest
from selenium.webdriver.common.by import By
from conftest import navigate, click, fill, submit_and_wait

STUDENT_NAME  = "Selenium Learner"
STUDENT_EMAIL = "sel.learner@test.edu"
STUDENT_ID    = "SELL001"


def test_add_student(driver):
    navigate(driver, "/students")

    click(driver, "button-add-student")

    fill(driver, "input-student-name",  STUDENT_NAME)
    fill(driver, "input-student-email", STUDENT_EMAIL)
    fill(driver, "input-student-id",    STUDENT_ID)
    fill(driver, "input-student-year",  "3")
    fill(driver, "input-student-major", "Software Engineering")

    submit_and_wait(driver, "button-submit-student")

    page_text = driver.find_element(By.TAG_NAME, "body").text
    assert STUDENT_NAME in page_text or STUDENT_ID in page_text, (
        f"Expected '{STUDENT_NAME}' or '{STUDENT_ID}' on page. "
        f"Snippet: {page_text[:400]!r}"
    )
