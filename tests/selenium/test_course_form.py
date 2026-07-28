"""SP7 — Test: create a course via the course form."""
import pytest
from selenium.webdriver.common.by import By
from conftest import navigate, click, fill, submit_and_wait, BASE_URL

COURSE_CODE = "SEL-201"
COURSE_NAME = "Selenium Intro Course"


def test_create_course(driver):
    navigate(driver, "/courses")

    click(driver, "button-add-course")

    fill(driver, "input-course-code",       COURSE_CODE)
    fill(driver, "input-course-name",       COURSE_NAME)
    fill(driver, "input-course-credits",    "3")
    fill(driver, "input-course-semester",   "Spring 2026")
    fill(driver, "input-course-instructor", "Prof. Selenium")

    # grading_scheme defaults to 'weighted' — no explicit selection needed
    submit_and_wait(driver, "button-submit-course")

    page_text = driver.find_element(By.TAG_NAME, "body").text
    assert COURSE_CODE in page_text or COURSE_NAME in page_text, (
        f"Expected '{COURSE_CODE}' or '{COURSE_NAME}' on the page. "
        f"Snippet: {page_text[:400]!r}"
    )
