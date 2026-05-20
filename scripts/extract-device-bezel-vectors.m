#import <Foundation/Foundation.h>

#import "XCWChromeRenderer.h"

static NSString *const SDDeviceTypesPath =
    @"/Library/Developer/CoreSimulator/Profiles/DeviceTypes";
static NSString *const SDDeviceKitChromePath =
    @"/Library/Developer/DeviceKit/Chrome";
static NSString *const SDDeviceKitFramebufferMasksPath =
    @"/Library/Developer/DeviceKit/FramebufferMasks";

static NSString *SDFamilyForDevice(NSString *deviceName, NSDictionary *profile) {
    if ([deviceName hasPrefix:@"iPhone "]) {
        return @"iphone";
    }
    if ([deviceName hasPrefix:@"iPad "]) {
        return @"ipad";
    }
    if ([deviceName hasPrefix:@"Apple Watch "]) {
        return @"apple-watch";
    }

    NSArray *families = [profile[@"supportedProductFamilyIDs"] isKindOfClass:[NSArray class]]
        ? profile[@"supportedProductFamilyIDs"]
        : @[];
    BOOL supportsWatch = NO;
    BOOL supportsPad = NO;
    BOOL supportsPhone = NO;
    for (id family in families) {
        if (![family respondsToSelector:@selector(integerValue)]) {
            continue;
        }
        NSInteger value = [family integerValue];
        supportsPhone = supportsPhone || value == 1;
        supportsPad = supportsPad || value == 2;
        supportsWatch = supportsWatch || value == 4;
    }
    if (supportsWatch) {
        return @"apple-watch";
    }
    if (supportsPad && [deviceName containsString:@"iPad"]) {
        return @"ipad";
    }
    if (supportsPhone && [deviceName containsString:@"iPhone"]) {
        return @"iphone";
    }
    return nil;
}

static NSString *SDSlugComponent(NSString *value) {
    NSMutableString *mutable = [[value ?: @"" lowercaseString] mutableCopy];
    CFStringTransform((__bridge CFMutableStringRef)mutable, NULL, kCFStringTransformToLatin, false);
    CFStringTransform((__bridge CFMutableStringRef)mutable, NULL, kCFStringTransformStripCombiningMarks, false);

    NSMutableString *slug = [NSMutableString string];
    BOOL previousDash = NO;
    for (NSUInteger i = 0; i < mutable.length; i++) {
        unichar ch = [mutable characterAtIndex:i];
        if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
            [slug appendFormat:@"%C", ch];
            previousDash = NO;
        } else if (!previousDash) {
            [slug appendString:@"-"];
            previousDash = YES;
        }
    }
    while ([slug hasPrefix:@"-"]) {
        [slug deleteCharactersInRange:NSMakeRange(0, 1)];
    }
    while ([slug hasSuffix:@"-"]) {
        [slug deleteCharactersInRange:NSMakeRange(slug.length - 1, 1)];
    }
    return slug.length > 0 ? slug : @"device";
}

static NSString *SDUniqueSlug(NSString *deviceName,
                              NSDictionary *profile,
                              NSMutableSet<NSString *> *usedSlugs) {
    NSString *model = [profile[@"modelIdentifier"] isKindOfClass:[NSString class]]
        ? profile[@"modelIdentifier"]
        : @"";
    NSString *base = model.length > 0
        ? [NSString stringWithFormat:@"%@-%@", SDSlugComponent(deviceName), SDSlugComponent(model)]
        : SDSlugComponent(deviceName);
    NSString *candidate = base;
    NSUInteger suffix = 2;
    while ([usedSlugs containsObject:candidate]) {
        candidate = [NSString stringWithFormat:@"%@-%lu", base, (unsigned long)suffix++];
    }
    [usedSlugs addObject:candidate];
    return candidate;
}

static BOOL SDEnsureDirectory(NSString *path, NSMutableArray<NSDictionary *> *errors, NSString *label) {
    NSError *error = nil;
    BOOL ok = [[NSFileManager defaultManager] createDirectoryAtPath:path
                                        withIntermediateDirectories:YES
                                                         attributes:nil
                                                              error:&error];
    if (!ok) {
        [errors addObject:@{
            @"item": label ?: path.lastPathComponent ?: @"",
            @"error": error.localizedDescription ?: @"Unable to create directory.",
        }];
    }
    return ok;
}

static BOOL SDCopyFile(NSString *source,
                       NSString *destination,
                       NSMutableArray<NSDictionary *> *errors,
                       NSString *label) {
    if (source.length == 0 || destination.length == 0) {
        return NO;
    }
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if (![fileManager fileExistsAtPath:source]) {
        [errors addObject:@{
            @"item": label ?: source.lastPathComponent ?: @"",
            @"error": [NSString stringWithFormat:@"Missing source file: %@", source],
        }];
        return NO;
    }
    if ([fileManager fileExistsAtPath:destination]) {
        return YES;
    }
    NSString *directory = destination.stringByDeletingLastPathComponent;
    if (!SDEnsureDirectory(directory, errors, label)) {
        return NO;
    }
    NSError *error = nil;
    if (![fileManager copyItemAtPath:source toPath:destination error:&error]) {
        [errors addObject:@{
            @"item": label ?: source.lastPathComponent ?: @"",
            @"error": error.localizedDescription ?: @"Unable to copy file.",
            @"source": source,
            @"destination": destination,
        }];
        return NO;
    }
    return YES;
}

static id SDJSONObjectOrNull(id value) {
    return value ?: [NSNull null];
}

static NSArray<NSString *> *SDSortedDirectoryEntries(NSString *path) {
    NSArray<NSString *> *entries = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:path error:nil];
    return [entries sortedArrayUsingSelector:@selector(localizedCaseInsensitiveCompare:)] ?: @[];
}

static NSDictionary *SDCopyChromeBundle(NSString *chromeName,
                                        NSString *outputRoot,
                                        NSMutableDictionary<NSString *, NSDictionary *> *chromeBundles,
                                        NSMutableArray<NSDictionary *> *errors) {
    NSDictionary *existing = chromeBundles[chromeName];
    if (existing != nil) {
        return existing;
    }

    NSString *bundlePath = [SDDeviceKitChromePath stringByAppendingPathComponent:
        [NSString stringWithFormat:@"%@.devicechrome", chromeName]];
    NSString *contentsPath = [bundlePath stringByAppendingPathComponent:@"Contents"];
    NSString *resourcesPath = [contentsPath stringByAppendingPathComponent:@"Resources"];
    NSString *relativeBundlePath = [@"chrome" stringByAppendingPathComponent:chromeName];
    NSString *destinationPath = [outputRoot stringByAppendingPathComponent:relativeBundlePath];

    NSMutableArray<NSString *> *pdfs = [NSMutableArray array];
    for (NSString *entry in SDSortedDirectoryEntries(resourcesPath)) {
        NSString *source = [resourcesPath stringByAppendingPathComponent:entry];
        BOOL directory = NO;
        if (![[NSFileManager defaultManager] fileExistsAtPath:source isDirectory:&directory] || directory) {
            continue;
        }
        if ([entry.pathExtension.lowercaseString isEqualToString:@"pdf"]) {
            NSString *relative = [relativeBundlePath stringByAppendingPathComponent:entry];
            NSString *destination = [outputRoot stringByAppendingPathComponent:relative];
            if (SDCopyFile(source, destination, errors, chromeName)) {
                [pdfs addObject:relative];
            }
        }
    }

    NSString *chromeJsonRelative = [relativeBundlePath stringByAppendingPathComponent:@"chrome.json"];
    SDCopyFile([resourcesPath stringByAppendingPathComponent:@"chrome.json"],
               [outputRoot stringByAppendingPathComponent:chromeJsonRelative],
               errors,
               chromeName);
    SDCopyFile([contentsPath stringByAppendingPathComponent:@"Info.plist"],
               [destinationPath stringByAppendingPathComponent:@"Info.plist"],
               errors,
               chromeName);
    SDCopyFile([contentsPath stringByAppendingPathComponent:@"version.plist"],
               [destinationPath stringByAppendingPathComponent:@"version.plist"],
               errors,
               chromeName);

    NSDictionary *manifest = @{
        @"chromeName": chromeName,
        @"bundlePath": bundlePath,
        @"resourcesPath": resourcesPath,
        @"localPath": relativeBundlePath,
        @"chromeJson": chromeJsonRelative,
        @"pdfs": pdfs,
    };
    NSData *manifestData = [NSJSONSerialization dataWithJSONObject:manifest
                                                           options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys
                                                             error:nil];
    if (manifestData.length > 0) {
        [manifestData writeToFile:[destinationPath stringByAppendingPathComponent:@"manifest.json"]
                          options:NSDataWritingAtomic
                            error:nil];
    }

    chromeBundles[chromeName] = manifest;
    return manifest;
}

static NSString *SDCopyFramebufferMask(NSString *maskName,
                                       NSString *deviceResourcesPath,
                                       NSString *outputRoot,
                                       NSMutableArray<NSDictionary *> *errors) {
    if (maskName.length == 0) {
        return nil;
    }
    NSString *relative = [@"framebuffer-masks" stringByAppendingPathComponent:
        [maskName stringByAppendingPathExtension:@"pdf"]];
    NSString *destination = [outputRoot stringByAppendingPathComponent:relative];
    NSString *source = [deviceResourcesPath stringByAppendingPathComponent:
        [maskName stringByAppendingPathExtension:@"pdf"]];
    if (![[NSFileManager defaultManager] fileExistsAtPath:source]) {
        source = [SDDeviceKitFramebufferMasksPath stringByAppendingPathComponent:
            [maskName stringByAppendingPathExtension:@"pdf"]];
    }
    return SDCopyFile(source, destination, errors, maskName) ? relative : nil;
}

static NSString *SDCopySensorBar(NSString *sensorName,
                                 NSString *deviceResourcesPath,
                                 NSString *slug,
                                 NSString *outputRoot,
                                 NSMutableArray<NSDictionary *> *errors) {
    if (sensorName.length == 0) {
        return nil;
    }
    NSString *source = [deviceResourcesPath stringByAppendingPathComponent:
        [sensorName stringByAppendingPathExtension:@"pdf"]];
    NSString *relativeDirectory = [@"device-profiles" stringByAppendingPathComponent:slug];
    NSString *relative = [relativeDirectory stringByAppendingPathComponent:@"sensor-bar.pdf"];
    NSString *destination = [outputRoot stringByAppendingPathComponent:relative];
    return SDCopyFile(source, destination, errors, sensorName) ? relative : nil;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSString *outputRoot = argc > 1
            ? [NSString stringWithUTF8String:argv[1]]
            : [[[NSFileManager defaultManager] currentDirectoryPath] stringByAppendingPathComponent:@"assets/device-bezel-vectors"];
        outputRoot = [outputRoot stringByStandardizingPath];

        NSFileManager *fileManager = [NSFileManager defaultManager];
        NSError *directoryError = nil;
        [fileManager removeItemAtPath:outputRoot error:nil];
        if (![fileManager createDirectoryAtPath:outputRoot
                    withIntermediateDirectories:YES
                                     attributes:nil
                                          error:&directoryError]) {
            fprintf(stderr, "Unable to create output directory: %s\n",
                    directoryError.localizedDescription.UTF8String);
            return 1;
        }

        NSArray<NSString *> *entries = SDSortedDirectoryEntries(SDDeviceTypesPath);
        NSMutableArray<NSDictionary *> *devices = [NSMutableArray array];
        NSMutableArray<NSDictionary *> *errors = [NSMutableArray array];
        NSMutableDictionary<NSString *, NSNumber *> *counts = [@{
            @"iphone": @0,
            @"ipad": @0,
            @"apple-watch": @0,
        } mutableCopy];
        NSMutableSet<NSString *> *usedSlugs = [NSMutableSet set];
        NSMutableDictionary<NSString *, NSDictionary *> *chromeBundles = [NSMutableDictionary dictionary];
        NSMutableSet<NSString *> *framebufferMasks = [NSMutableSet set];
        NSMutableSet<NSString *> *sensorBars = [NSMutableSet set];

        for (NSString *entry in entries) {
            if (![entry.pathExtension isEqualToString:@"simdevicetype"]) {
                continue;
            }

            NSString *deviceName = entry.stringByDeletingPathExtension;
            NSString *bundlePath = [SDDeviceTypesPath stringByAppendingPathComponent:entry];
            NSString *resourcesPath = [bundlePath stringByAppendingPathComponent:@"Contents/Resources"];
            NSString *profilePath = [resourcesPath stringByAppendingPathComponent:@"profile.plist"];
            NSDictionary *profile = [NSDictionary dictionaryWithContentsOfFile:profilePath];
            if (![profile isKindOfClass:[NSDictionary class]]) {
                continue;
            }

            NSString *family = SDFamilyForDevice(deviceName, profile);
            if (family == nil) {
                continue;
            }

            NSString *chromeIdentifier = [profile[@"chromeIdentifier"] isKindOfClass:[NSString class]]
                ? profile[@"chromeIdentifier"]
                : @"";
            NSString *chromeName = [chromeIdentifier stringByReplacingOccurrencesOfString:@"com.apple.dt.devicekit.chrome."
                                                                               withString:@""];
            if (chromeName.length == 0) {
                [errors addObject:@{
                    @"item": deviceName,
                    @"error": @"Device profile did not include a DeviceKit chrome identifier.",
                }];
                continue;
            }

            NSError *geometryError = nil;
            NSDictionary *geometry = [XCWChromeRenderer profileForDeviceName:deviceName error:&geometryError];
            if (geometry == nil) {
                [errors addObject:@{
                    @"item": deviceName,
                    @"error": geometryError.localizedDescription ?: @"Unable to resolve chrome geometry.",
                }];
                continue;
            }

            NSString *slug = SDUniqueSlug(deviceName, profile, usedSlugs);
            NSDictionary *chromeBundle = SDCopyChromeBundle(chromeName, outputRoot, chromeBundles, errors);

            NSString *relativeProfileDirectory = [@"device-profiles" stringByAppendingPathComponent:slug];
            NSString *relativeProfilePlist = [relativeProfileDirectory stringByAppendingPathComponent:@"profile.plist"];
            SDCopyFile(profilePath,
                       [outputRoot stringByAppendingPathComponent:relativeProfilePlist],
                       errors,
                       deviceName);

            NSString *capabilitiesPath = [resourcesPath stringByAppendingPathComponent:@"capabilities.plist"];
            NSString *relativeCapabilitiesPlist = nil;
            if ([fileManager fileExistsAtPath:capabilitiesPath]) {
                relativeCapabilitiesPlist = [relativeProfileDirectory stringByAppendingPathComponent:@"capabilities.plist"];
                SDCopyFile(capabilitiesPath,
                           [outputRoot stringByAppendingPathComponent:relativeCapabilitiesPlist],
                           errors,
                           deviceName);
            }

            NSString *framebufferMask = [profile[@"framebufferMask"] isKindOfClass:[NSString class]]
                ? profile[@"framebufferMask"]
                : @"";
            NSString *relativeFramebufferMask = SDCopyFramebufferMask(framebufferMask, resourcesPath, outputRoot, errors);
            if (relativeFramebufferMask.length > 0) {
                [framebufferMasks addObject:relativeFramebufferMask];
            }

            NSString *sensorBarImage = [profile[@"sensorBarImage"] isKindOfClass:[NSString class]]
                ? profile[@"sensorBarImage"]
                : @"";
            NSString *relativeSensorBar = SDCopySensorBar(sensorBarImage, resourcesPath, slug, outputRoot, errors);
            if (relativeSensorBar.length > 0) {
                [sensorBars addObject:relativeSensorBar];
            }

            NSDictionary *screen = @{
                @"pixelWidth": SDJSONObjectOrNull(profile[@"mainScreenWidth"]),
                @"pixelHeight": SDJSONObjectOrNull(profile[@"mainScreenHeight"]),
                @"scale": SDJSONObjectOrNull(profile[@"mainScreenScale"]),
                @"widthDPI": SDJSONObjectOrNull(profile[@"mainScreenWidthDPI"]),
                @"heightDPI": SDJSONObjectOrNull(profile[@"mainScreenHeightDPI"]),
            };

            NSMutableDictionary *vectors = [@{
                @"chromeBundle": SDJSONObjectOrNull(chromeBundle[@"localPath"]),
                @"chromeJson": SDJSONObjectOrNull(chromeBundle[@"chromeJson"]),
                @"chromePdfs": SDJSONObjectOrNull(chromeBundle[@"pdfs"]),
                @"profilePlist": relativeProfilePlist,
                @"capabilitiesPlist": relativeCapabilitiesPlist ?: [NSNull null],
                @"framebufferMask": relativeFramebufferMask ?: [NSNull null],
                @"sensorBar": relativeSensorBar ?: [NSNull null],
            } mutableCopy];

            NSDictionary *deviceMetadata = @{
                @"name": deviceName,
                @"slug": slug,
                @"family": family,
                @"modelIdentifier": SDJSONObjectOrNull(profile[@"modelIdentifier"]),
                @"productClass": SDJSONObjectOrNull(profile[@"productClass"]),
                @"chromeIdentifier": chromeIdentifier,
                @"chromeName": chromeName,
                @"screen": screen,
                @"geometry": geometry,
                @"vectors": vectors,
                @"source": @{
                    @"deviceProfilePath": profilePath,
                    @"deviceResourcesPath": resourcesPath,
                    @"chromeResourcesPath": chromeBundle[@"resourcesPath"] ?: @"",
                    @"framebufferMask": framebufferMask.length > 0 ? framebufferMask : [NSNull null],
                    @"sensorBarImage": sensorBarImage.length > 0 ? sensorBarImage : [NSNull null],
                },
            };

            NSString *deviceDirectory = [outputRoot stringByAppendingPathComponent:
                [[family stringByAppendingPathComponent:slug] stringByStandardizingPath]];
            SDEnsureDirectory(deviceDirectory, errors, deviceName);
            NSData *metadataData = [NSJSONSerialization dataWithJSONObject:deviceMetadata
                                                                   options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys
                                                                     error:nil];
            if (metadataData.length > 0) {
                [metadataData writeToFile:[deviceDirectory stringByAppendingPathComponent:@"profile.json"]
                                  options:NSDataWritingAtomic
                                    error:nil];
            }

            [devices addObject:deviceMetadata];
            counts[family] = @([counts[family] unsignedIntegerValue] + 1);
            printf("copied %-11s %s\n", family.UTF8String, deviceName.UTF8String);
        }

        NSArray *chromeBundleList = [[chromeBundles allValues] sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *left, NSDictionary *right) {
            return [left[@"chromeName"] compare:right[@"chromeName"] options:NSCaseInsensitiveSearch];
        }];
        NSArray *framebufferMaskList = [[framebufferMasks allObjects] sortedArrayUsingSelector:@selector(localizedCaseInsensitiveCompare:)];
        NSArray *sensorBarList = [[sensorBars allObjects] sortedArrayUsingSelector:@selector(localizedCaseInsensitiveCompare:)];

        NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
        formatter.locale = [NSLocale localeWithLocaleIdentifier:@"en_US_POSIX"];
        formatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ssZZZZZ";
        formatter.timeZone = [NSTimeZone localTimeZone];

        NSDictionary *index = @{
            @"generatedAt": [formatter stringFromDate:[NSDate date]],
            @"source": @{
                @"deviceTypesPath": SDDeviceTypesPath,
                @"deviceKitChromePath": SDDeviceKitChromePath,
                @"deviceKitFramebufferMasksPath": SDDeviceKitFramebufferMasksPath,
                @"renderer": @"SimDeck XCWChromeRenderer geometry",
                @"vectorFormat": @"PDF",
            },
            @"counts": @{
                @"total": @(devices.count),
                @"iphone": counts[@"iphone"],
                @"ipad": counts[@"ipad"],
                @"appleWatch": counts[@"apple-watch"],
                @"chromeBundles": @(chromeBundleList.count),
                @"framebufferMasks": @(framebufferMaskList.count),
                @"sensorBars": @(sensorBarList.count),
                @"errors": @(errors.count),
            },
            @"chromeBundles": chromeBundleList,
            @"framebufferMasks": framebufferMaskList,
            @"sensorBars": sensorBarList,
            @"devices": devices,
            @"errors": errors,
        };

        NSData *indexData = [NSJSONSerialization dataWithJSONObject:index
                                                            options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys
                                                              error:nil];
        if (indexData.length == 0) {
            fprintf(stderr, "Unable to encode vector index.\n");
            return 1;
        }
        [indexData writeToFile:[outputRoot stringByAppendingPathComponent:@"index.json"]
                       options:NSDataWritingAtomic
                         error:nil];

        printf("wrote %lu vector profiles to %s\n",
               (unsigned long)devices.count,
               outputRoot.UTF8String);
        if (errors.count > 0) {
            printf("completed with %lu recoverable errors; see index.json\n",
                   (unsigned long)errors.count);
        }
    }
    return 0;
}
