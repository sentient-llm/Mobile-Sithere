import Foundation

enum UserRole: String, Codable, CaseIterable, Identifiable {
    case owner
    case walker
    case admin

    var id: String { rawValue }
}

enum WalkStatus: String, Codable {
    case pending
    case accepted
    case declined
    case inProgress = "in_progress"
    case completed
    case cancelled
}

struct AuthSession: Codable, Equatable {
    var accessToken: String
    var refreshToken: String?
    var expiresAt: Date?
}

struct Profile: Codable, Identifiable {
    var id: UUID
    var role: UserRole
    var fullName: String
    var email: String
    var phone: String?

    enum CodingKeys: String, CodingKey {
        case id, role, email, phone
        case fullName = "full_name"
    }
}

struct Pet: Codable, Identifiable, Hashable {
    var id: UUID
    var ownerId: UUID?
    var name: String
    var breed: String?
    var ageYears: Double?
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case id, name, breed, notes
        case ownerId = "owner_id"
        case ageYears = "age_years"
    }
}

struct WalkerProfile: Codable, Identifiable, Hashable {
    var userId: UUID
    var bio: String
    var rateCents: Int
    var tags: [String]
    var verified: Bool
    var availability: String
    var profile: ProfileSummary?

    var id: UUID { userId }

    enum CodingKeys: String, CodingKey {
        case bio, tags, verified, availability, profile
        case userId = "user_id"
        case rateCents = "rate_cents"
    }
}

struct ProfileSummary: Codable, Hashable {
    var id: UUID
    var fullName: String
    var email: String?

    enum CodingKeys: String, CodingKey {
        case id, email
        case fullName = "full_name"
    }
}

struct WalkRequest: Codable, Identifiable, Hashable {
    var id: UUID
    var ownerId: UUID
    var petId: UUID
    var walkerId: UUID?
    var requestedStartAt: Date
    var durationMinutes: Int
    var status: WalkStatus
    var address: String?
    var notes: String?
    var totalCents: Int

    enum CodingKeys: String, CodingKey {
        case id, status, address, notes
        case ownerId = "owner_id"
        case petId = "pet_id"
        case walkerId = "walker_id"
        case requestedStartAt = "requested_start_at"
        case durationMinutes = "duration_minutes"
        case totalCents = "total_cents"
    }
}

struct WalkSession: Codable, Identifiable, Hashable {
    var id: UUID
    var walkRequestId: UUID
    var status: String

    enum CodingKeys: String, CodingKey {
        case id, status
        case walkRequestId = "walk_request_id"
    }
}

struct LiveLocation: Codable, Hashable {
    var latitude: Double
    var longitude: Double
    var elapsedSeconds: Int
    var distanceMiles: Double

    enum CodingKeys: String, CodingKey {
        case latitude, longitude
        case elapsedSeconds = "elapsed_seconds"
        case distanceMiles = "distance_miles"
    }
}

struct Report: Codable, Identifiable, Hashable {
    var id: UUID
    var mood: String
    var notes: String?
    var ownerRating: Int?
    var submittedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, mood, notes
        case ownerRating = "owner_rating"
        case submittedAt = "submitted_at"
    }
}

struct Conversation: Codable, Identifiable, Hashable {
    var id: UUID
    var ownerId: UUID
    var walkerId: UUID
    var lastMessageAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case walkerId = "walker_id"
        case lastMessageAt = "last_message_at"
    }
}

struct Message: Codable, Identifiable, Hashable {
    var id: UUID
    var conversationId: UUID
    var senderId: UUID
    var body: String
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, body
        case conversationId = "conversation_id"
        case senderId = "sender_id"
        case createdAt = "created_at"
    }
}

struct VetLocation: Codable, Identifiable, Hashable {
    var id: UUID
    var name: String
    var address: String
    var phone: String?
    var emergency: Bool
    var hours: String?
    var rating: Double?
}

struct MeResponse: Codable {
    var profile: Profile
    var ownerProfile: EmptyObject?
    var walkerProfile: WalkerProfile?
    var pets: [Pet]
}

struct EmptyObject: Codable, Hashable {}
