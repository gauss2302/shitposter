class DomainError(Exception):
    """Base exception for expected application/domain failures."""


class NotFoundError(DomainError):
    """Raised when an entity cannot be found or is not visible to the actor."""


class UnauthorizedError(DomainError):
    """Raised when the current request has no valid authenticated user."""


class ValidationError(DomainError):
    """Raised when a use case receives invalid input."""
