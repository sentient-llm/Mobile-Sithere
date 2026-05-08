import Foundation
import PhotosUI
import SwiftUI

final class PhotoUploadService {
    private let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    func storageUploadURL(bucket: String, path: String) -> URL {
        environment.supabaseURL.appending(path: "/storage/v1/object/\(bucket)/\(path)")
    }

    func loadImageData(from item: PhotosPickerItem) async throws -> Data? {
        try await item.loadTransferable(type: Data.self)
    }
}
