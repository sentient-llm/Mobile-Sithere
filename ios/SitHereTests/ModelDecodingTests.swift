import XCTest
@testable import SitHere

final class ModelDecodingTests: XCTestCase {
    func testProfileDecoding() throws {
        let json = """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "role": "owner",
          "full_name": "Alex Owner",
          "email": "alex@example.com"
        }
        """.data(using: .utf8)!

        let profile = try JSONDecoder().decode(Profile.self, from: json)
        XCTAssertEqual(profile.role, .owner)
        XCTAssertEqual(profile.fullName, "Alex Owner")
    }
}
