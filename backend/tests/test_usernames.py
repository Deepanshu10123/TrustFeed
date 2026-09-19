"""
Fast, no-network tests for the username rules (see app/core/usernames.py) --
pure logic, so they run in CI alongside test_gate.py.
"""

import pytest

from app.core.usernames import check_username


def test_a_plain_username_is_fine():
    assert check_username("deepanshu") == ("deepanshu", None)


def test_letters_numbers_and_underscores_are_allowed():
    assert check_username("trust_feed_42")[1] is None


def test_it_is_lower_cased_so_case_cannot_make_two_names():
    assert check_username("DeepAnshu") == ("deepanshu", None)


def test_spaces_and_a_leading_at_sign_are_dropped():
    assert check_username("  @Deepanshu ") == ("deepanshu", None)


@pytest.mark.parametrize("bad", ["ab", "", "   ", "a" * 21])
def test_wrong_length_is_rejected(bad):
    assert check_username(bad)[1] is not None


def test_length_limits_are_inclusive():
    assert check_username("abc")[1] is None
    assert check_username("a" * 20)[1] is None


@pytest.mark.parametrize("bad", ["dee panshu", "deep.anshu", "deep-anshu", "deepanshu!", "dëepanshu", "@@deepanshu"])
def test_other_characters_are_rejected(bad):
    assert check_username(bad)[1] is not None


@pytest.mark.parametrize("reserved", ["admin", "Admin", "@TrustFeed", "support"])
def test_names_that_pass_for_the_app_are_reserved(reserved):
    assert check_username(reserved)[1] == "That username isn't available."
