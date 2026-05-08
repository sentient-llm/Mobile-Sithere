import Foundation

enum AppError: LocalizedError {
    case unauthorized
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Please sign in again."
        case .invalidResponse:
            return "The server returned an unexpected response."
        case .server(let message):
            return message
        }
    }
}
