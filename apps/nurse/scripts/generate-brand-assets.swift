import AppKit
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

private let canvasSize = NSSize(width: 1024, height: 1024)

private func loadImage(_ path: String) -> NSImage {
  guard let image = NSImage(contentsOfFile: path) else {
    fatalError("Unable to load source image at \(path)")
  }
  return image
}

private func drawCareBadge(in context: CGContext) {
  context.saveGState()

  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.98))
  context.fillEllipse(in: CGRect(x: 695, y: 59, width: 268, height: 268))

  context.setFillColor(CGColor(red: 1.0, green: 0.39, blue: 0.29, alpha: 1.0))
  context.fillEllipse(in: CGRect(x: 710, y: 74, width: 238, height: 238))

  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  context.addPath(CGPath(roundedRect: CGRect(x: 752, y: 168, width: 154, height: 50), cornerWidth: 25, cornerHeight: 25, transform: nil))
  context.fillPath()
  context.addPath(CGPath(roundedRect: CGRect(x: 804, y: 116, width: 50, height: 154), cornerWidth: 25, cornerHeight: 25, transform: nil))
  context.fillPath()

  context.restoreGState()
}

private func render(source: NSImage, destination: String, transparent: Bool) throws {
  let width = Int(canvasSize.width)
  let height = Int(canvasSize.height)
  let alphaInfo: CGImageAlphaInfo = transparent ? .premultipliedLast : .noneSkipLast
  guard let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: alphaInfo.rawValue
  ) else {
    fatalError("Unable to create brand asset canvas")
  }

  var sourceRect = NSRect(origin: .zero, size: source.size)
  guard let sourceImage = source.cgImage(forProposedRect: &sourceRect, context: nil, hints: nil) else {
    fatalError("Unable to decode source image")
  }
  context.interpolationQuality = .high
  context.draw(sourceImage, in: CGRect(origin: .zero, size: canvasSize))
  drawCareBadge(in: context)

  guard let outputImage = context.makeImage(),
        let destinationWriter = CGImageDestinationCreateWithURL(
          URL(fileURLWithPath: destination) as CFURL,
          UTType.png.identifier as CFString,
          1,
          nil
        ) else {
    fatalError("Unable to prepare brand asset output")
  }
  CGImageDestinationAddImage(destinationWriter, outputImage, nil)
  guard CGImageDestinationFinalize(destinationWriter) else {
    fatalError("Unable to encode brand asset")
  }
}

guard CommandLine.arguments.count == 5 else {
  fatalError("Usage: generate-brand-assets.swift <icon-source> <mark-source> <icon-destination> <mark-destination>")
}

let iconSource = loadImage(CommandLine.arguments[1])
let markSource = loadImage(CommandLine.arguments[2])

try render(source: iconSource, destination: CommandLine.arguments[3], transparent: false)
try render(source: markSource, destination: CommandLine.arguments[4], transparent: true)
